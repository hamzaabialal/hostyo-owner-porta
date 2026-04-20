/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import {
  findTurnover, findTurnoverById, updateTurnover, pageToTurnover,
} from "@/lib/notion-turnovers";
import { listIssuesForTurnover, createIssue, pageToIssue } from "@/lib/notion-issues";

export const dynamic = "force-dynamic";

/**
 * Public endpoint for cleaner actions:
 *   addPhoto, removePhoto, addIssue, startTimer, submit, updateNotes
 * Auth: cleaner token + propertyId + departureDate (must match turnover record).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, propertyId, departureDate } = body;
    if (!token || !propertyId || !departureDate) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const page = await findTurnover(propertyId, departureDate);
    if (!page) {
      return NextResponse.json({ error: "Turnover not found" }, { status: 404 });
    }
    const current = pageToTurnover(page);
    if (!current.cleanerToken || current.cleanerToken !== token) {
      return NextResponse.json({ error: "Link is no longer valid" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { addPhoto, removePhoto, addIssue, startTimer, submit, notes } = body;
    const updates: Record<string, unknown> = {};
    const newItems = { ...current.items };
    let itemsChanged = false;

    if (addPhoto && addPhoto.itemKey && addPhoto.url) {
      const photo = {
        url: addPhoto.url,
        uploadedAt: now,
        exifDateTime: addPhoto.exifDateTime,
        deviceModel: addPhoto.deviceModel,
        latitude: addPhoto.latitude,
        longitude: addPhoto.longitude,
        size: addPhoto.size,
        name: addPhoto.name,
      };
      newItems[addPhoto.itemKey] = [...(newItems[addPhoto.itemKey] || []), photo];
      itemsChanged = true;
      if (current.status === "Pending") updates.status = "In progress";
    }
    if (removePhoto && removePhoto.itemKey) {
      newItems[removePhoto.itemKey] = (newItems[removePhoto.itemKey] || []).filter((p: any) => p.url !== removePhoto.url);
      if (newItems[removePhoto.itemKey].length === 0) delete newItems[removePhoto.itemKey];
      itemsChanged = true;
    }
    if (addIssue && addIssue.description) {
      await createIssue({
        turnoverPageId: page.id,
        departureDate,
        category: addIssue.category,
        title: addIssue.title,
        description: String(addIssue.description).trim(),
        severity: addIssue.severity,
        photoUrl: addIssue.photoUrl,
      });
    }
    if (startTimer && !current.timerStartedAt) {
      updates.timerStartedAt = now;
      if (current.status === "Pending") updates.status = "In progress";
    }
    if (notes !== undefined) updates.notes = String(notes);
    if (submit) updates.status = "Submitted";

    if (itemsChanged) updates.items = newItems;
    if (Object.keys(updates).length > 0) {
      await updateTurnover(page.id, updates);
    }

    const freshPage = await findTurnoverById(page.id);
    const issues = await listIssuesForTurnover(page.id);
    const rec = freshPage
      ? pageToTurnover(freshPage, issues.map(pageToIssue))
      : current;
    return NextResponse.json({ ok: true, data: { ...rec, id: rec.compositeId } });
  } catch (err: any) {
    console.error("POST /api/turnovers/cleaner/submit failed:", err);
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}
