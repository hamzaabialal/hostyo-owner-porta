/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getUserScope } from "@/lib/scope";
import { randomUUID } from "crypto";
import {
  findTurnover, findTurnoverById, listTurnovers,
  createTurnover, updateTurnover, pageToTurnover,
} from "@/lib/notion-turnovers";
import { listAllIssues, listIssuesForTurnover, createIssue, setIssueResolved, pageToIssue } from "@/lib/notion-issues";

export const dynamic = "force-dynamic";

// Re-export the canonical types for components importing from here
export type { TurnoverRecord, TurnoverPhoto } from "@/lib/notion-turnovers";

export interface TurnoverIssue {
  id: string;
  category?: string;
  title?: string;
  description: string;
  photoUrl?: string;
  severity?: "Low" | "Medium" | "High";
  createdAt: string;
  resolved?: boolean;
}

/** GET — fetch turnover(s). Admin only. */
export async function GET(req: NextRequest) {
  try {
    const scope = await getUserScope(req);
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!scope.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id");              // legacy composite id `propId__date`
    const propertyId = url.searchParams.get("propertyId");
    const departureDate = url.searchParams.get("departureDate");
    const issuesFlag = url.searchParams.get("issues");

    // All issues across all turnovers (for the Issues tab)
    if (issuesFlag === "1") {
      const [issuePages, turnoverPages] = await Promise.all([listAllIssues(), listTurnovers()]);
      const turnoverById = new Map<string, any>();
      for (const t of turnoverPages) turnoverById.set(t.id, t);

      const flat = issuePages.map((p) => {
        const iss = pageToIssue(p);
        const t = turnoverById.get(iss.turnoverPageId);
        const turnover = t ? pageToTurnover(t) : null;
        return {
          ...iss,
          propertyId: turnover?.propertyId || "",
          propertyName: turnover?.propertyName || "",
          propertyLocation: "",
          propertyCoverUrl: "",
          departureDate: iss.departureDate || turnover?.departureDate || "",
        };
      });
      flat.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      return NextResponse.json({ ok: true, data: flat });
    }

    // Single turnover by composite id or (propertyId, departureDate)
    if (id) {
      const [pid, dep] = id.split("__");
      const page = await findTurnover(pid, dep);
      if (!page) return NextResponse.json({ ok: true, data: null });
      const issues = await listIssuesForTurnover(page.id);
      return NextResponse.json({ ok: true, data: { ...pageToTurnover(page, issues.map(pageToIssue)), id } });
    }
    if (propertyId && departureDate) {
      const page = await findTurnover(propertyId, departureDate);
      if (!page) return NextResponse.json({ ok: true, data: null });
      const issues = await listIssuesForTurnover(page.id);
      const rec = pageToTurnover(page, issues.map(pageToIssue));
      return NextResponse.json({ ok: true, data: { ...rec, id: rec.compositeId } });
    }

    // List everything
    const pages = await listTurnovers();
    // Fetch issues per turnover in parallel (could be slow for many turnovers)
    const enriched = await Promise.all(pages.map(async (p) => {
      const issues = await listIssuesForTurnover(p.id);
      const rec = pageToTurnover(p, issues.map(pageToIssue));
      return { ...rec, id: rec.compositeId };
    }));
    return NextResponse.json({ ok: true, data: enriched });
  } catch (err) {
    console.error("GET /api/turnovers failed:", err);
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST — assign cleaner + generate link (admin only) */
export async function POST(req: NextRequest) {
  try {
    const scope = await getUserScope(req);
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!scope.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

    const body = await req.json();
    const { propertyId, propertyName, departureDate, cleanerName } = body;
    if (!propertyId || !departureDate) {
      return NextResponse.json({ error: "propertyId + departureDate required" }, { status: 400 });
    }

    let page = await findTurnover(propertyId, departureDate);
    const token = randomUUID();
    if (!page) {
      page = await createTurnover({
        propertyId,
        propertyName,
        departureDate,
        status: "Pending",
        cleanerName: cleanerName || "",
        cleanerToken: token,
        items: {},
      });
    } else {
      await updateTurnover(page.id, {
        cleanerName: cleanerName || "",
        cleanerToken: token,
      });
      // re-fetch so response has fresh data (not strictly needed)
    }

    const rec = pageToTurnover(page);
    return NextResponse.json({ ok: true, data: { ...rec, cleanerToken: token, id: rec.compositeId } });
  } catch (err) {
    console.error("POST /api/turnovers failed:", err);
    const message = err instanceof Error ? err.message : "Failed to create turnover";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH — update record (admin-only fields vs cleaner-allowed fields) */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { propertyId, departureDate, token } = body;
    if (!propertyId || !departureDate) {
      return NextResponse.json({ error: "propertyId + departureDate required" }, { status: 400 });
    }

    const scope = await getUserScope(req);
    const isAdmin = scope?.isAdmin === true;

    let page = await findTurnover(propertyId, departureDate);

    // Admin may auto-create a record when adding an issue/note/photo against a
    // turnover that doesn't exist yet. This does NOT generate a cleanerToken —
    // that stays the job of the POST endpoint (cleaner assignment).
    if (!page && isAdmin) {
      page = await createTurnover({
        propertyId,
        propertyName: body.propertyName,
        departureDate,
        status: "Pending",
        items: {},
      });
    }
    if (!page) return NextResponse.json({ error: "Turnover not found" }, { status: 404 });

    const currentRecord = pageToTurnover(page);
    const isCleaner = !!token && currentRecord.cleanerToken === token;
    if (!isAdmin && !isCleaner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date().toISOString();
    const { addPhoto, removePhoto, status, notes, addIssue, resolveIssue, startTimer, stopTimer, expireLink, approve } = body;
    const updates: Record<string, unknown> = {};
    const newItems = { ...currentRecord.items };
    let itemsChanged = false;

    // ── Cleaner-allowed actions ──
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
      if (currentRecord.status === "Pending") updates.status = "In progress";
    }
    if (removePhoto && removePhoto.itemKey) {
      newItems[removePhoto.itemKey] = (newItems[removePhoto.itemKey] || []).filter((p) => p.url !== removePhoto.url);
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
    if (startTimer && !currentRecord.timerStartedAt) {
      updates.timerStartedAt = now;
    }

    // ── Admin-only ──
    if (isAdmin) {
      if (stopTimer && currentRecord.timerStartedAt && !currentRecord.timerStoppedAt) {
        updates.timerStoppedAt = now;
      }
      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      if (resolveIssue) {
        await setIssueResolved(resolveIssue, true);
      }
      if (expireLink) {
        updates.cleanerToken = ""; // clearing token effectively expires the link
      }
      if (approve) {
        updates.status = "Completed";
        updates.cleanerToken = "";
      }
    }

    // Cleaner submitting for review
    if (isCleaner && body.submit) {
      updates.status = "Submitted";
    }

    if (itemsChanged) updates.items = newItems;
    if (Object.keys(updates).length > 0) {
      await updateTurnover(page.id, updates);
    }

    // Re-read fresh state
    const freshPage = await findTurnoverById(page.id);
    const issues = await listIssuesForTurnover(page.id);
    const rec = freshPage
      ? pageToTurnover(freshPage, issues.map(pageToIssue))
      : currentRecord;
    return NextResponse.json({ ok: true, data: { ...rec, id: rec.compositeId } });
  } catch (err) {
    console.error("PATCH /api/turnovers failed:", err);
    const message = err instanceof Error ? err.message : "Failed to save turnover";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
