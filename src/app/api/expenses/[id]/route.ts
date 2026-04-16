/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { invalidate } from "@/lib/cache";
import { syncPropertyBalances, syncDeficitAdjustments } from "@/lib/sync-balances";
import { getUserScope, isInScope } from "@/lib/scope";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

/**
 * Read the property name(s) attached to an expense page so we can sync the
 * right balance after an update/delete. Returns an array because in theory
 * an update can move an expense from one property to another, in which case
 * BOTH properties' balances need refreshing.
 */
async function getExpenseInfo(expenseId: string): Promise<{ properties: string[]; reservationRef: string }> {
  try {
    const page: any = await notion.pages.retrieve({ page_id: expenseId });
    const prop = page.properties?.["Property"];
    const properties: string[] = [];
    if (prop?.type === "select" && prop.select?.name) properties.push(prop.select.name);
    else if (prop?.type === "rich_text" && prop.rich_text?.[0]?.plain_text) properties.push(prop.rich_text[0].plain_text);

    const resProp = page.properties?.["Reservation ID"];
    let reservationRef = "";
    if (resProp?.type === "rich_text") reservationRef = resProp.rich_text?.[0]?.plain_text || "";
    else if (resProp?.type === "title") reservationRef = resProp.title?.[0]?.plain_text || "";

    return { properties, reservationRef: reservationRef.trim() };
  } catch {
    return { properties: [], reservationRef: "" };
  }
}

/** PATCH — update expense status/category */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const scope = await getUserScope(req);
    if (!scope) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Capture info BEFORE the edit so we know to sync even if
    // the edit moves the expense to a different property.
    const oldInfo = await getExpenseInfo(id);

    // Owner can only modify expenses on their own properties
    if (!scope.isAdmin) {
      const owns = oldInfo.properties.some((p) => isInScope(scope, p));
      if (!owns) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    // Owner cannot move an expense to a property outside their scope
    if (body.property && !isInScope(scope, body.property)) {
      return NextResponse.json({ ok: false, error: "Forbidden — target property not in your scope" }, { status: 403 });
    }

    const properties: any = {};

    if (body.status !== undefined && body.status !== "") {
      properties["Status "] = { status: { name: body.status } };
    }
    if (body.category !== undefined && body.category !== "") {
      properties["Category "] = { select: { name: body.category } };
    }
    if (body.notes !== undefined) {
      properties["Notes"] = { rich_text: [{ text: { content: body.notes } }] };
    }
    if (body.vendor !== undefined) {
      properties["Vendor Name"] = { rich_text: [{ text: { content: body.vendor } }] };
    }
    if (body.amount !== undefined) {
      const numVal = parseFloat(body.amount) || 0;
      properties["Amount"] = { rich_text: [{ text: { content: String(numVal) } }] };
    }

    console.log("[expense PATCH]", id, "properties:", JSON.stringify(properties));

    try {
      await notion.pages.update({ page_id: id, properties });
    } catch (firstErr: any) {
      // If Amount type mismatch, retry with number type
      if (firstErr?.message?.includes("Amount") && properties["Amount"]) {
        console.log("[expense PATCH] Retrying Amount as number type");
        const numVal = parseFloat(properties["Amount"].rich_text?.[0]?.text?.content || "0");
        properties["Amount"] = { number: numVal };
        await notion.pages.update({ page_id: id, properties });
      } else if (firstErr?.message?.includes("Category") && properties["Category "]) {
        // Try without trailing space
        console.log("[expense PATCH] Retrying Category without trailing space");
        properties["Category"] = properties["Category "];
        delete properties["Category "];
        await notion.pages.update({ page_id: id, properties });
      } else if (firstErr?.message?.includes("Status") && properties["Status "]) {
        console.log("[expense PATCH] Retrying Status without trailing space");
        properties["Status"] = properties["Status "];
        delete properties["Status "];
        await notion.pages.update({ page_id: id, properties });
      } else {
        throw firstErr;
      }
    }

    // Invalidate cache so next fetch gets fresh data
    invalidate("expenses");

    // Refresh affected property balances in Notion immediately.
    const newProperty = body.property as string | undefined;
    const propsToSync = [...oldInfo.properties];
    if (newProperty && !propsToSync.includes(newProperty)) propsToSync.push(newProperty);
    if (propsToSync.length > 0) {
      await syncPropertyBalances(propsToSync);
      // Roll forward deficit adjustments for affected properties
      await syncDeficitAdjustments(propsToSync);
    }

    // Sync the Expenses column on the linked reservation (if any)
    const resRef = oldInfo.reservationRef || (body.reservation as string | undefined) || "";
    if (resRef) {
      const { syncReservationExpenses } = await import("@/lib/sync-balances");
      await syncReservationExpenses(resRef);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Update expense error:", error?.body || error?.message || error);
    const msg = error?.body?.message || error?.message || "Update failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** DELETE — archive expense */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const scope = await getUserScope(req);
    if (!scope) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Capture info BEFORE deletion so we know which balance + reservation to refresh
    const delInfo = await getExpenseInfo(id);

    // Owner can only delete expenses on their own properties
    if (!scope.isAdmin) {
      const owns = delInfo.properties.some((p) => isInScope(scope, p));
      if (!owns) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    await notion.pages.update({ page_id: id, archived: true });

    // Invalidate cache
    invalidate("expenses");

    // Refresh affected property balance in Notion immediately
    if (delInfo.properties.length > 0) {
      await syncPropertyBalances(delInfo.properties);
      // Re-run deficit adjustments for affected properties
      await syncDeficitAdjustments(delInfo.properties);
    }

    // Sync the Expenses column on the linked reservation (if any)
    if (delInfo.reservationRef) {
      const { syncReservationExpenses } = await import("@/lib/sync-balances");
      await syncReservationExpenses(delInfo.reservationRef);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Delete expense error:", error?.message);
    return NextResponse.json({ ok: false, error: error?.message || "Delete failed" }, { status: 500 });
  }
}
