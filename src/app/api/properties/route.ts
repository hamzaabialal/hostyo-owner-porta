/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import notion from "@/lib/notion";
import { queryDatabase, getProp, DB } from "@/lib/notion";
import { cached, invalidate } from "@/lib/cache";
import { getUserScope, filterByScope } from "@/lib/scope";

export const dynamic = "force-dynamic";

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
      cleaning: getProp(p, "Cleaning") === true,
      propertyType: getProp(p, "Property Type") || "",
      bedrooms: getProp(p, "Bedrooms") || 0,
      bathrooms: getProp(p, "Bathrooms") || 0,
      maxGuests: getProp(p, "Max Guests") || 0,
      bedTypes: getProp(p, "Bed Types") || "",
      internalNotes: getProp(p, "Internal Notes") || "",
      features: getProp(p, "Features") || "",
      condition: getProp(p, "Condition") || "",
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
    if (!scope.isAdmin) return NextResponse.json({ error: "Forbidden — only admins can create properties" }, { status: 403 });

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
