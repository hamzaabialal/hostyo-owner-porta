/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { invalidate } from "@/lib/cache";
import { syncPropertyBalances } from "@/lib/sync-balances";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

/**
 * Read the property name(s) attached to an expense page so we can sync the
 * right balance after an update/delete. Returns an array because in theory
 * an update can move an expense from one property to another, in which case
 * BOTH properties' balances need refreshing.
 */
async function getExpensePropertyNames(expenseId: string): Promise<string[]> {
  try {
    const page: any = await notion.pages.retrieve({ page_id: expenseId });
    const prop = page.properties?.["Property"];
    if (!prop) return [];
    if (prop.type === "select") return prop.select?.name ? [prop.select.name] : [];
    if (prop.type === "rich_text") {
      const txt = prop.rich_text?.[0]?.plain_text;
      return txt ? [txt] : [];
    }
    return [];
  } catch {
    return [];
  }
}

/** PATCH — update expense status/category */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Capture the property BEFORE the edit so we know to sync it even if
    // the edit moves the expense to a different property.
    const oldProperties = await getExpensePropertyNames(id);

    const body = await req.json();
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
    // We sync BOTH the old property and (if the body changed it) the new one.
    const newProperty = body.property as string | undefined;
    const propsToSync = [...oldProperties];
    if (newProperty && !propsToSync.includes(newProperty)) propsToSync.push(newProperty);
    if (propsToSync.length > 0) {
      await syncPropertyBalances(propsToSync);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Update expense error:", error?.body || error?.message || error);
    const msg = error?.body?.message || error?.message || "Update failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** DELETE — archive expense */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Capture property BEFORE deletion so we know which balance to refresh
    const propertyNames = await getExpensePropertyNames(id);

    await notion.pages.update({ page_id: id, archived: true });

    // Invalidate cache
    invalidate("expenses");

    // Refresh affected property balance in Notion immediately
    if (propertyNames.length > 0) {
      await syncPropertyBalances(propertyNames);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Delete expense error:", error?.message);
    return NextResponse.json({ ok: false, error: error?.message || "Delete failed" }, { status: 500 });
  }
}
