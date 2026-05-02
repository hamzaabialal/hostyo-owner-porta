/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import notion from "@/lib/notion";
import { queryDatabase, getProp, DB } from "@/lib/notion";
import { cached, invalidate } from "@/lib/cache";
import { getUserScope, filterByScope } from "@/lib/scope";

export const dynamic = "force-dynamic";

/**
 * Reads a Notion rich_text property as a single concatenated string,
 * preserving content beyond the first 2000-char segment. We use this for the
 * "Checklist Overrides" JSON blob — typical payloads are tiny but the format
 * grows linearly with the number of toggled/custom items, and we want to
 * avoid the silent-truncation bug we previously hit on Items JSON.
 */
function getRichTextAll(page: any, name: string): string {
  const prop = page?.properties?.[name];
  if (!prop || prop.type !== "rich_text" || !Array.isArray(prop.rich_text)) return "";
  return prop.rich_text.map((seg: any) => seg?.plain_text || "").join("");
}

/** Chunks an arbitrary-length string into Notion's 2000-char rich_text segments. */
const CHECKLIST_RT_CHUNK = 2000;
const CHECKLIST_RT_MAX_SEGMENTS = 100;
function richTextChunked(s?: string) {
  if (!s) return [];
  const out: { type: "text"; text: { content: string } }[] = [];
  for (let i = 0; i < s.length && out.length < CHECKLIST_RT_MAX_SEGMENTS; i += CHECKLIST_RT_CHUNK) {
    out.push({ type: "text" as const, text: { content: s.slice(i, i + CHECKLIST_RT_CHUNK) } });
  }
  return out;
}

async function fetchProperties() {
  const pages = await queryDatabase(DB.properties);

  return pages.map((p: any) => {
    // Extract cover image — fall back to first Photos file if no cover
    let coverUrl = "";
    if (p.cover?.type === "file") coverUrl = p.cover.file.url;
    else if (p.cover?.type === "external") coverUrl = p.cover.external.url;

    if (!coverUrl) {
      const photosProp = p.properties?.["Photos"];
      if (photosProp?.type === "files" && photosProp.files?.length > 0) {
        const first = photosProp.files[0];
        coverUrl = first.file?.url || first.external?.url || "";
      }
    }

    return {
      id: p.id,
      name: getProp(p, "Name") || "",
      coverUrl,
      status: getProp(p, "Status") || "Draft",
      address: getProp(p, "Address") || "",
      postcode: getProp(p, "Postcode") || "",
      location: getProp(p, "Location") || "",
      city: getProp(p, "City") || "",
      country: getProp(p, "Country") || "",
      client: getProp(p, "Client") || "",
      email: getProp(p, "Email") || "",
      firstName: getProp(p, "First Name") || "",
      lastName: getProp(p, "Last Name") || "",
      phone: getProp(p, "Phone") || "",
      iban: getProp(p, "IBAN") || "",
      counterpartyId: getProp(p, "Counterparty Id") || "",
      license: getProp(p, "License") || "",
      price: getProp(p, "Price") || 0,
      cleaningFee: getProp(p, "Cleaning Fee") || 0,
      accessCode: getProp(p, "Access Code") || "",
      connectedChannels: getProp(p, "Connected Channels") || [],
      checkInGuide: getProp(p, "Check - In Guide") || "",
      photos: getProp(p, "Photos") || "",
      property: getProp(p, "Property") || "",
      ical: getProp(p, "ical") || "",
      listingId: getProp(p, "Listing ID") || 0,
      googleDrive: getProp(p, "Google Drive") || "",
      skipAutomation: getProp(p, "Skip Automation") || false,
      balance: getProp(p, "Balance") || 0,
      deficitStatus: getProp(p, "Deficit Status") || "",
      cleaning: getProp(p, "Cleaning Enabled") === true || getProp(p, "Cleaning") === true,
      propertyType: getProp(p, "Property Type") || "",
      bedrooms: getProp(p, "Bedrooms") || 0,
      bathrooms: getProp(p, "Bathrooms") || 0,
      maxGuests: getProp(p, "Max Guests") || 0,
      bedTypes: getProp(p, "Bed Types") || "",
      internalNotes: getProp(p, "Internal Notes") || "",
      features: getProp(p, "Features") || "",
      condition: getProp(p, "Condition") || "",
      // Main Spaces flags (for dynamic turnover checklist)
      livingRoom: getProp(p, "Living Room") === true,
      balcony: getProp(p, "Balcony") === true,
      hallway: getProp(p, "Hallway") === true,
      // Amenities multi-select (list of names)
      amenities: getProp(p, "Amenities") || [],
      // Per-apartment stock subcategories (multi-select)
      stockSubcategories: getProp(p, "Stock Subcategories") || [],
      // Per-property turnover-checklist overrides (JSON in rich_text). The
      // raw string is shipped as-is; the client parses it via
      // `parseChecklistOverrides()` before merging into buildChecklist().
      checklistOverrides: getRichTextAll(p, "Checklist Overrides"),
    };
  });
}

export async function GET(req: NextRequest) {
  if (!DB.properties) {
    return NextResponse.json({ source: "placeholder", data: [] });
  }

  try {
    const scope = await getUserScope(req);
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // `?fresh=1` busts the in-memory cache so the next read goes straight to
    // Notion. We need this whenever the caller knows it just wrote (e.g. the
    // checklist editor), or whenever stale data would silently hide a recent
    // change (e.g. the turnover detail page reading per-property overrides
    // right after the admin updated them on another tab).
    const url = new URL(req.url);
    if (url.searchParams.get("fresh") === "1") {
      invalidate("properties");
    }

    const properties = await cached("properties", fetchProperties);
    const scoped = filterByScope(scope, properties, (p: any) => p.name || "");
    return NextResponse.json({ source: "notion", data: scoped });
  } catch (error) {
    console.error("Error fetching properties:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!DB.properties) {
    return NextResponse.json({ error: "Properties DB not configured" }, { status: 500 });
  }

  try {
    const scope = await getUserScope(request);
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!scope.isAdmin) return NextResponse.json({ error: "Only admins can create properties" }, { status: 403 });

    const body = await request.json();

    // Build Notion properties object
    const properties: any = {
      Name: { title: [{ text: { content: body.name || "" } }] },
    };

    // Rich text fields
    const richTextFields: Record<string, string> = {
      Address: body.address,
      Postcode: body.postcode,
      Location: body.location,
      Client: body.client,
      "First Name": body.firstName,
      "Last Name": body.lastName,
      IBAN: body.iban,
      "Counterparty Id": body.counterpartyId,
      "Access Code": body.accessCode,
      Photos: body.photos,
      Property: body.property,
      ical: body.ical,
      "Google Drive": body.googleDrive,
      "Bed Types": body.bedTypes,
      "Internal Notes": body.internalNotes,
      "Features": body.features,
      "Condition": body.condition,
    };

    for (const [key, val] of Object.entries(richTextFields)) {
      if (val) {
        properties[key] = { rich_text: [{ text: { content: val } }] };
      }
    }

    // Select fields
    if (body.status) properties.Status = { select: { name: body.status } };
    if (body.city) properties.City = { select: { name: body.city } };
    if (body.country) properties.Country = { select: { name: body.country } };
    if (body.propertyType) properties["Property Type"] = { select: { name: body.propertyType } };

    // Multi-select
    if (body.connectedChannels?.length) {
      properties["Connected Channels"] = {
        multi_select: body.connectedChannels.map((c: string) => ({ name: c })),
      };
    }

    // Number fields
    if (body.price) properties.Price = { number: body.price };
    if (body.cleaningFee) properties["Cleaning Fee"] = { number: body.cleaningFee };
    if (body.listingId) properties["Listing ID"] = { number: body.listingId };
    if (body.bedrooms) properties.Bedrooms = { number: body.bedrooms };
    if (body.bathrooms) properties.Bathrooms = { number: body.bathrooms };
    if (body.maxGuests) properties["Max Guests"] = { number: body.maxGuests };

    // Email
    if (body.email) properties.Email = { email: body.email };

    // Phone
    if (body.phone) properties.Phone = { phone_number: body.phone };

    // URL
    if (body.checkInGuide) properties["Check - In Guide"] = { url: body.checkInGuide };

    // Checkbox
    if (body.skipAutomation !== undefined) {
      properties["Skip Automation"] = { checkbox: body.skipAutomation };
    }

    const response = await notion.pages.create({
      parent: { database_id: DB.properties },
      properties,
    });

    // Invalidate cache so next GET fetches fresh data
    invalidate("properties");

    return NextResponse.json({ success: true, id: response.id });
  } catch (error: any) {
    console.error("Error creating property:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create property" },
      { status: 500 }
    );
  }
}

/** PATCH — update a property's fields (admin only).
 * Currently supports Main Spaces (bedrooms, bathrooms, livingRoom, balcony,
 * hallway) and Amenities (multi-select). The turnover checklist re-renders
 * against the new values on the next fetch.
 */
export async function PATCH(request: NextRequest) {
  if (!DB.properties) {
    return NextResponse.json({ error: "Properties DB not configured" }, { status: 500 });
  }
  try {
    const scope = await getUserScope(request);
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!scope.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const properties: any = {};
    if (updates.bedrooms !== undefined) properties["Bedrooms"] = { number: Number(updates.bedrooms) || 0 };
    if (updates.bathrooms !== undefined) properties["Bathrooms"] = { number: Number(updates.bathrooms) || 0 };
    if (updates.livingRoom !== undefined) properties["Living Room"] = { checkbox: !!updates.livingRoom };
    if (updates.balcony !== undefined) properties["Balcony"] = { checkbox: !!updates.balcony };
    if (updates.hallway !== undefined) properties["Hallway"] = { checkbox: !!updates.hallway };
    if (Array.isArray(updates.amenities)) {
      properties["Amenities"] = { multi_select: updates.amenities.map((name: string) => ({ name })) };
    }
    if (Array.isArray(updates.stockSubcategories)) {
      properties["Stock Subcategories"] = {
        multi_select: updates.stockSubcategories.map((name: string) => ({ name })),
      };
    }
    // Per-property turnover-checklist overrides (JSON blob, chunked into
    // Notion's 2000-char rich_text segments so a long override list never
    // truncates).
    if (typeof updates.checklistOverrides === "string") {
      properties["Checklist Overrides"] = { rich_text: richTextChunked(updates.checklistOverrides) };
    }

    if (Object.keys(properties).length === 0) {
      return NextResponse.json({ error: "No recognised updates" }, { status: 400 });
    }

    await notion.pages.update({ page_id: id, properties });
    invalidate("properties");

    // Re-read the updated page directly from Notion and shape it the same way
    // fetchProperties() does. This avoids in-memory cache staleness between
    // serverless instances — the client can use this response directly instead
    // of refetching /api/properties.
    const page: any = await (notion as any).pages.retrieve({ page_id: id });
    let coverUrl = "";
    if (page.cover?.type === "file") coverUrl = page.cover.file.url;
    else if (page.cover?.type === "external") coverUrl = page.cover.external.url;
    if (!coverUrl) {
      const photosProp = page.properties?.["Photos"];
      if (photosProp?.type === "files" && photosProp.files?.length > 0) {
        const first = photosProp.files[0];
        coverUrl = first.file?.url || first.external?.url || "";
      }
    }
    const property = {
      id: page.id,
      name: getProp(page, "Name") || "",
      coverUrl,
      status: getProp(page, "Status") || "Draft",
      address: getProp(page, "Address") || "",
      postcode: getProp(page, "Postcode") || "",
      location: getProp(page, "Location") || "",
      city: getProp(page, "City") || "",
      country: getProp(page, "Country") || "",
      client: getProp(page, "Client") || "",
      email: getProp(page, "Email") || "",
      firstName: getProp(page, "First Name") || "",
      lastName: getProp(page, "Last Name") || "",
      phone: getProp(page, "Phone") || "",
      iban: getProp(page, "IBAN") || "",
      counterpartyId: getProp(page, "Counterparty Id") || "",
      license: getProp(page, "License") || "",
      price: getProp(page, "Price") || 0,
      cleaningFee: getProp(page, "Cleaning Fee") || 0,
      accessCode: getProp(page, "Access Code") || "",
      connectedChannels: getProp(page, "Connected Channels") || [],
      checkInGuide: getProp(page, "Check - In Guide") || "",
      photos: getProp(page, "Photos") || "",
      property: getProp(page, "Property") || "",
      ical: getProp(page, "ical") || "",
      listingId: getProp(page, "Listing ID") || 0,
      googleDrive: getProp(page, "Google Drive") || "",
      skipAutomation: getProp(page, "Skip Automation") || false,
      balance: getProp(page, "Balance") || 0,
      deficitStatus: getProp(page, "Deficit Status") || "",
      cleaning: getProp(page, "Cleaning Enabled") === true || getProp(page, "Cleaning") === true,
      propertyType: getProp(page, "Property Type") || "",
      bedrooms: getProp(page, "Bedrooms") || 0,
      bathrooms: getProp(page, "Bathrooms") || 0,
      maxGuests: getProp(page, "Max Guests") || 0,
      bedTypes: getProp(page, "Bed Types") || "",
      internalNotes: getProp(page, "Internal Notes") || "",
      features: getProp(page, "Features") || "",
      condition: getProp(page, "Condition") || "",
      livingRoom: getProp(page, "Living Room") === true,
      balcony: getProp(page, "Balcony") === true,
      hallway: getProp(page, "Hallway") === true,
      amenities: getProp(page, "Amenities") || [],
      stockSubcategories: getProp(page, "Stock Subcategories") || [],
      checklistOverrides: getRichTextAll(page, "Checklist Overrides"),
    };
    return NextResponse.json({ ok: true, property });
  } catch (error: any) {
    console.error("Error updating property:", error);
    return NextResponse.json({ error: error?.message || "Failed to update property" }, { status: 500 });
  }
}
