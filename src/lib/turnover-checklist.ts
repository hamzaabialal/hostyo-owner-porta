// Turnover cleaning checklist — category + subcategory + item structure
// Each "item" represents one photo check the cleaner needs to complete.

export interface ChecklistItem {
  /** Stable slug used as a key for persistence */
  id: string;
  label: string;
}

export interface ChecklistSubcategory {
  id: string;
  label: string;
  items: ChecklistItem[];
}

export interface ChecklistCategory {
  id: string;
  label: string;
  /**
   * If true, this category is repeated per room-instance (e.g. Bedroom 1, Bedroom 2).
   * Controlled by the property's bedrooms/bathrooms count.
   */
  perRoom?: "bedrooms" | "bathrooms";
  subcategories: ChecklistSubcategory[];
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function items(labels: string[]): ChecklistItem[] {
  return labels.map((l) => ({ id: slug(l), label: l }));
}

/* ── Base catalog (singular categories) ── */

const KITCHEN: ChecklistCategory = {
  id: "kitchen",
  label: "Kitchen",
  subcategories: [
    { id: "overview", label: "Overview", items: items([
      "Full kitchen wide shot",
      "Secondary angle of kitchen",
      "Kitchen table / dining area wide shot",
    ])},
    { id: "surfaces", label: "Surfaces", items: items([
      "Countertops",
      "Backsplash",
      "Kitchen table surface",
      "Chairs / seating area",
      "Window glass",
      "Window sill / frame",
    ])},
    { id: "sink-zone", label: "Sink zone", items: items([
      "Sink basin",
      "Sink drain close-up",
      "Tap / faucet close-up",
      "Under sink floor / plumbing area",
    ])},
    { id: "bin-area", label: "Bin area", items: items([
      "Inside bin",
      "Bin lid / exterior",
    ])},
    { id: "appliances", label: "Appliances", items: items([
      "Oven exterior",
      "Oven interior",
      "Hob / stovetop",
      "Extractor hood underside",
      "Extractor hood top",
      "Washing machine interior (door open)",
      "Washing machine detergent tray",
      "Washing machine rubber seal / rim",
      "Microwave interior",
      "Microwave exterior / handle",
      "Dishwasher interior",
      "Dishwasher filter area",
    ])},
    { id: "cold-storage", label: "Cold storage", items: items([
      "Fridge interior",
      "Freezer interior",
      "Fridge door shelves",
      "Fridge seals / edges",
    ])},
    { id: "small-appliances", label: "Small appliances", items: items([
      "Kettle exterior",
      "Kettle interior",
      "Toaster exterior",
      "Toaster slots / crumb tray",
      "Coffee machine exterior",
      "Coffee machine drip tray & pod area",
    ])},
    { id: "cupboards", label: "Cupboards / contents", items: items([
      "Inside cupboards",
      "Glasses / mugs cupboard interior",
      "Representative glasses / mugs clean shot",
      "Plates / bowls cupboard",
      "Cutlery drawer",
      "Pots / pans drawer or cupboard",
    ])},
  ],
};

const BEDROOM: ChecklistCategory = {
  id: "bedroom",
  label: "Bedroom",
  perRoom: "bedrooms",
  subcategories: [
    { id: "overview", label: "Overview", items: items([
      "Full room wide shot (main angle)",
      "Secondary angle (depth view)",
    ])},
    { id: "bed", label: "Bed", items: items([
      "Bed fully made (top/angled)",
      "Pillow arrangement (close-up)",
      "Mattress protector (if visible pre-make)",
      "Bed base / frame edges",
      "Under bed (dust check)",
    ])},
    { id: "linen", label: "Linen / presentation", items: items([
      "Duvet condition (smooth, no creases)",
      "Pillowcases clean (close-up)",
      "Spare linen (if provided)",
    ])},
    { id: "furniture-surfaces", label: "Furniture & surfaces", items: items([
      "Bedside tables",
      "Chest of drawers surface",
      "Desk / vanity (if present)",
      "Shelves / décor",
    ])},
    { id: "storage", label: "Storage", items: items([
      "Wardrobe interior",
      "Hangers present",
      "Drawer interiors (at least 1 open)",
      "Inside safe (if applicable)",
    ])},
    { id: "mirrors-glass", label: "Mirrors & glass", items: items([
      "Mirror (no streaks)",
    ])},
    { id: "soft-furnishings", label: "Soft furnishings", items: items([
      "Curtains / blinds",
      "Headboard (fabric/leather dust check)",
    ])},
    { id: "floors", label: "Floors", items: items([
      "Floor / under rug",
      "Corners of room",
    ])},
    { id: "high-risk", label: "High-risk checks", items: items([
      "Light switches",
      "Door handles",
      "Skirting boards",
      "Behind bedside tables",
    ])},
  ],
};

const LIVING_ROOM: ChecklistCategory = {
  id: "living-room",
  label: "Living Room",
  subcategories: [
    { id: "overview", label: "Overview", items: items([
      "Full room wide shot",
      "Secondary angle",
    ])},
    { id: "seating", label: "Seating", items: items([
      "Sofa (full shot)",
      "Cushions (arranged, no stains)",
      "Under cushions (crumb check)",
      "Under sofa (dust/debris)",
    ])},
    { id: "surfaces", label: "Surfaces", items: items([
      "Coffee table",
      "Side tables",
      "TV unit surface",
      "Shelves",
    ])},
    { id: "electronics", label: "Electronics", items: items([
      "TV screen (clean, off)",
      "Remote controls (present + clean)",
      "Router / visible cables (tidy)",
    ])},
    { id: "soft-furnishings", label: "Soft furnishings", items: items([
      "Throws / blankets (folded)",
      "Curtains / blinds",
    ])},
    { id: "floors", label: "Floors", items: items([
      "Floor / rug condition",
      "Corners / edges",
    ])},
    { id: "windows", label: "Windows", items: items([
      "Window glass",
      "Window sill",
      "Window rails",
    ])},
    { id: "high-risk", label: "High-risk checks", items: items([
      "Light switches",
      "Door handles",
      "Skirting boards",
      "Behind TV / unit",
    ])},
  ],
};

const BATHROOM: ChecklistCategory = {
  id: "bathroom",
  label: "Bathroom",
  perRoom: "bathrooms",
  subcategories: [
    { id: "overview", label: "Overview", items: items([
      "Full bathroom wide shot",
      "Bathroom windows",
      "Window rail",
    ])},
    { id: "toilet", label: "Toilet", items: items([
      "Close ups",
      "Behind / around toilet",
      "Toilet seat up",
      "Toilet exterior",
      "Toilet bowl inside (clear water)",
      "Flush button / handle",
    ])},
    { id: "shower-bath", label: "Shower / bath", items: items([
      "Shower glass (no streaks)",
      "Shower tray / floor",
      "Shower drain (close-up)",
      "Shower head (close-up)",
      "Hose",
      "Bath interior (if applicable)",
    ])},
    { id: "sink-area", label: "Sink area", items: items([
      "Sink basin",
      "Sink drain (close-up)",
      "Tap (no limescale)",
      "Mirror (no streaks)",
      "Vanity surface",
    ])},
    { id: "storage", label: "Storage", items: items([
      "Inside bathroom cabinet",
      "Shelves",
    ])},
    { id: "extras", label: "Extras", items: items([
      "Towel rails",
      "Toilet paper holder",
      "Soap dispenser area",
    ])},
    { id: "floors", label: "Floors", items: items([
      "Floor condition",
      "Corners",
      "Behind toilet",
    ])},
    { id: "high-risk", label: "High-risk checks", items: items([
      "Grout lines",
      "Silicone edges",
      "Behind bin",
      "Under sink cabinet",
    ])},
  ],
};

const BALCONY: ChecklistCategory = {
  id: "balcony",
  label: "Balcony",
  subcategories: [
    { id: "overview", label: "Overview", items: items([
      "Full balcony wide shot",
    ])},
    { id: "furniture", label: "Furniture", items: items([
      "Table surface",
      "Chairs (all)",
      "Cushions inside",
    ])},
    { id: "floors", label: "Floors", items: items([
      "Floor condition (dust/leaves)",
      "Corners / edges",
    ])},
    { id: "glass-railings", label: "Glass / railings", items: items([
      "Glass panels (no smears)",
      "Railings (dust)",
    ])},
    { id: "extras", label: "Extras", items: items([
      "Ashtray (empty)",
      "Planters (tidy, no debris)",
      "Drain (if present)",
    ])},
    { id: "high-risk", label: "High-risk checks", items: items([
      "Bird droppings",
      "Wind-blown debris",
      "Cobwebs (corners/ceiling)",
    ])},
  ],
};

const HALLWAY: ChecklistCategory = {
  id: "hallway",
  label: "Hallway",
  subcategories: [
    { id: "overview", label: "Overview", items: items([
      "Entry area wide shot",
    ])},
    { id: "surfaces", label: "Surfaces", items: items([
      "Console / table",
      "Shoe rack",
    ])},
    { id: "fixtures", label: "Fixtures", items: items([
      "Door interior",
      "Door handle",
      "Locks / key area",
    ])},
    { id: "floors", label: "Floors", items: items([
      "Floor condition",
      "Mat (clean)",
    ])},
    { id: "high-risk", label: "High-risk checks", items: items([
      "Light switches",
      "Corners",
      "Behind door",
    ])},
  ],
};

/**
 * Build the full checklist for a property, duplicating perRoom categories
 * (Bedroom, Bathroom) based on the property's bedroom / bathroom count.
 */
export function buildChecklist(property: { bedrooms?: number; bathrooms?: number }): ChecklistCategory[] {
  const bedCount = Math.max(1, property.bedrooms || 1);
  const bathCount = Math.max(1, property.bathrooms || 1);

  const categories: ChecklistCategory[] = [];
  categories.push(KITCHEN);
  categories.push(LIVING_ROOM);

  // Bedrooms — if only 1, keep as "Bedroom"; else number them
  if (bedCount === 1) {
    categories.push(BEDROOM);
  } else {
    for (let i = 1; i <= bedCount; i++) {
      categories.push({
        ...BEDROOM,
        id: `${BEDROOM.id}-${i}`,
        label: `Bedroom ${i}`,
      });
    }
  }

  // Bathrooms
  if (bathCount === 1) {
    categories.push(BATHROOM);
  } else {
    for (let i = 1; i <= bathCount; i++) {
      categories.push({
        ...BATHROOM,
        id: `${BATHROOM.id}-${i}`,
        label: `Bathroom ${i}`,
      });
    }
  }

  categories.push(BALCONY);
  categories.push(HALLWAY);

  return categories;
}

/** Total item count across all categories (used for progress %) */
export function countChecklistItems(categories: ChecklistCategory[]): number {
  let total = 0;
  for (const cat of categories) {
    for (const sub of cat.subcategories) {
      total += sub.items.length;
    }
  }
  return total;
}

/** Make a globally unique key for an item so its photo state can be persisted */
export function itemKey(categoryId: string, subcategoryId: string, itemId: string): string {
  return `${categoryId}.${subcategoryId}.${itemId}`;
}
