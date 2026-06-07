import type { CategoryDef, QuickListEntry, QuickSingleItem, TemplateHrs } from './types'
import { PROMPT_HRS } from './constants'

// ── Shelf Life Guide import dataset ──────────────────────────────────────────
// Source: Domino's "Shelf Life Guide" (PREP-13) — three pages mapped to the
// app's three label templates:
//   • Received / unopened product  → UX
//   • Prepped / opened product     → OX
//   • In-use product               → IX
//
// Durations are in hours. PROMPT_HRS (-1) means no fixed duration for that
// stage — "use-by-date", "end of day", etc. — and opens the calendar picker.
//
// "Keep received expiration date"  → OX is set equal to UX (no calendar needed).
// "Keep prepped expiration date"   → IX is set equal to OX (no calendar needed).

const P  = PROMPT_HRS
const d  = (n: number) => n * 24        // days  → hours
const mo = (n: number) => n * 30 * 24   // months (≈30 d) → hours
const yr = (n: number) => n * 365 * 24  // years → hours
const h  = (n: number) => n             // total hours

// Categories assigned during import. 'meat' / 'veggie' / 'sauce' are built-in
// (see ITEM_CATEGORIES); 'cheese' and 'dough' are added on first import.
export const SHELF_LIFE_CATS: CategoryDef[] = [
  { id: 'cheese', label: 'Cheese', color: '#d2a8ff' },
  { id: 'dough',  label: 'Dough',  color: '#ffa657' },
]

interface SeedItem {
  name: string
  category: string
  hrs: TemplateHrs
}

export const SHELF_LIFE_ITEMS: SeedItem[] = [
  // ── Sauces / liquids ──────────────────────────────────────────────────────
  // Alfredo OX: "keep received" → same as UX (7 days)
  { name: 'Alfredo',              category: 'sauce',  hrs: { UX: d(7),    OX: d(7),   IX: d(2)  } },
  { name: 'Buffalo Sauce',        category: 'sauce',  hrs: { UX: P,       OX: d(7),   IX: d(4)  } },
  // Garlic Parm Sauce IX: "keep prepped" → same as OX (4 days)
  { name: 'Garlic Parm Sauce',    category: 'sauce',  hrs: { UX: P,       OX: d(4),   IX: d(4)  } },
  // Garlic Oil Blend IX: "keep prepped" → same as OX (4 days)
  { name: 'Garlic Oil Blend',     category: 'sauce',  hrs: { UX: P,       OX: d(4),   IX: d(4)  } },
  { name: 'Butter Oil (BFO)',     category: 'sauce',  hrs: { UX: mo(9),   OX: d(60),  IX: d(2)  } },
  { name: 'Honey BBQ',            category: 'sauce',  hrs: { UX: P,       OX: d(7),   IX: d(4)  } },
  { name: 'Pizza Sauce',          category: 'sauce',  hrs: { UX: P,       OX: d(7),   IX: h(8)  } },
  { name: 'Ranch',                category: 'sauce',  hrs: { UX: P,       OX: d(7),   IX: d(4)  } },
  // Sweet Mango Habanero IX: "keep prepped" → same as OX (7 days)
  { name: 'Sweet Mango Habanero', category: 'sauce',  hrs: { UX: P,       OX: d(7),   IX: d(7)  } },
  { name: 'Nacho Cheese Cup',     category: 'sauce',  hrs: { UX: P,       OX: P,      IX: P     } },
  { name: 'Blue Cheese Cup',      category: 'sauce',  hrs: { UX: P,       OX: P,      IX: h(8)  } },
  { name: 'Slice Sauce Cup',      category: 'sauce',  hrs: { UX: P,       OX: P,      IX: d(2)  } },
  { name: 'Dipping Cups/Dressings', category: 'sauce', hrs: { UX: P,      OX: P,      IX: P     } },

  // ── Meats ─────────────────────────────────────────────────────────────────
  { name: 'Bacon',                category: 'meat',   hrs: { UX: P,       OX: d(7),   IX: d(2)  } },
  { name: 'Beef',                 category: 'meat',   hrs: { UX: d(11),   OX: d(7),   IX: d(2)  } },
  { name: 'Boneless Chicken',     category: 'meat',   hrs: { UX: d(8),    OX: d(3),   IX: d(2)  } },
  // Grilled Chicken OX: "keep received" → same as UX (7 days)
  { name: 'Grilled Chicken',      category: 'meat',   hrs: { UX: d(7),    OX: d(7),   IX: d(2)  } },
  { name: 'Chicken Wings',        category: 'meat',   hrs: { UX: d(8),    OX: d(3),   IX: d(2)  } },
  { name: 'Ham',                  category: 'meat',   hrs: { UX: P,       OX: d(7),   IX: d(2)  } },
  { name: 'Pepperoni',            category: 'meat',   hrs: { UX: P,       OX: d(7),   IX: d(2)  } },
  { name: 'Pepperoni (RFS)',      category: 'meat',   hrs: { UX: d(60),   OX: d(7),   IX: d(2)  } },
  { name: 'Philly Steak',         category: 'meat',   hrs: { UX: d(9),    OX: d(7),   IX: d(2)  } },
  { name: 'Italian Sausage',      category: 'meat',   hrs: { UX: d(11),   OX: d(7),   IX: d(2)  } },
  { name: 'Anchovies',            category: 'meat',   hrs: { UX: yr(1),   OX: P,      IX: d(2)  } },

  // ── Veggies / produce ─────────────────────────────────────────────────────
  { name: 'Banana Peppers',       category: 'veggie', hrs: { UX: P,       OX: d(10),  IX: d(2)  } },
  { name: 'Black Olives',         category: 'veggie', hrs: { UX: P,       OX: d(7),   IX: d(2)  } },
  { name: 'Green Olives',         category: 'veggie', hrs: { UX: P,       OX: d(14),  IX: d(2)  } },
  // Green Chilies OX: "keep received" → same as UX (7 days)
  { name: 'Green Chilies',        category: 'veggie', hrs: { UX: d(7),    OX: d(7),   IX: d(2)  } },
  { name: 'Green Peppers',        category: 'veggie', hrs: { UX: P,       OX: P,      IX: d(2)  } },
  { name: 'Jalapeno Peppers',     category: 'veggie', hrs: { UX: P,       OX: d(10),  IX: d(2)  } },
  { name: 'Mushrooms',            category: 'veggie', hrs: { UX: P,       OX: P,      IX: d(2)  } },
  { name: 'Onions',               category: 'veggie', hrs: { UX: P,       OX: P,      IX: d(2)  } },
  { name: 'Spinach',              category: 'veggie', hrs: { UX: P,       OX: P,      IX: d(2)  } },
  { name: 'Diced Tomatoes',       category: 'veggie', hrs: { UX: P,       OX: d(7),   IX: d(2)  } },
  { name: 'Chopped Garlic',       category: 'veggie', hrs: { UX: P,       OX: d(30),  IX: d(2)  } },
  { name: 'Crushed Red Pepper',   category: 'veggie', hrs: { UX: P,       OX: d(30),  IX: d(30) } },
  { name: 'Oregano',              category: 'veggie', hrs: { UX: P,       OX: P,      IX: d(60) } },
  { name: 'Salads',               category: 'veggie', hrs: { UX: P,       OX: P,      IX: P     } },

  // ── Cheeses ───────────────────────────────────────────────────────────────
  { name: 'American Cheese',      category: 'cheese', hrs: { UX: mo(3),   OX: d(7),   IX: d(2)  } },
  { name: 'Shredded Cheddar',     category: 'cheese', hrs: { UX: mo(6),   OX: d(10),  IX: d(2)  } },
  { name: 'Cheddar Blend',        category: 'cheese', hrs: { UX: P,       OX: d(7),   IX: d(2)  } },
  { name: 'Shredded Mozzarella',  category: 'cheese', hrs: { UX: d(14),   OX: d(7),   IX: d(2)  } },
  { name: 'Pizza Cheese',         category: 'cheese', hrs: { UX: d(9),    OX: d(7),   IX: d(2)  } },
  { name: 'Provolone',            category: 'cheese', hrs: { UX: d(14),   OX: d(7),   IX: d(2)  } },
  { name: 'Feta Crumbles',        category: 'cheese', hrs: { UX: mo(6),   OX: d(5),   IX: d(2)  } },
  { name: 'String Cheese',        category: 'cheese', hrs: { UX: d(14),   OX: d(7),   IX: d(2)  } },
  { name: 'Parmesan/Asiago',      category: 'cheese', hrs: { UX: P,       OX: d(10),  IX: d(2)  } },
  { name: 'Parmesan Shake-On',    category: 'cheese', hrs: { UX: P,       OX: d(21),  IX: d(3)  } },
  // Retail Parm Shaker IX: "keep prepped" → same as OX (30 days)
  { name: 'Retail Parm Shaker',   category: 'cheese', hrs: { UX: mo(6),   OX: d(30),  IX: d(30) } },
  { name: 'Parm Packets',         category: 'cheese', hrs: { UX: mo(6),   OX: P,      IX: P     } },
  { name: 'Garlic & Herb Shake',  category: 'cheese', hrs: { UX: P,       OX: P,      IX: d(30) } },

  // ── Dough / bread ─────────────────────────────────────────────────────────
  // GF Crusts OX: "keep received" → same as UX (20 days)
  { name: 'GF Crusts',            category: 'dough',  hrs: { UX: d(20),   OX: d(20),  IX: h(8)  } },
  // Thin Crust Shells OX: "keep received" → same as UX (20 days)
  { name: 'Thin Crust Shells',    category: 'dough',  hrs: { UX: d(20),   OX: d(20),  IX: h(8)  } },
  // Sandwich Bread OX: "keep received" → same as UX (6 days)
  { name: 'Sandwich Bread',       category: 'dough',  hrs: { UX: d(6),    OX: d(6),   IX: d(2)  } },
  { name: 'Bread Sides / Pan',    category: 'dough',  hrs: { UX: P,       OX: P,      IX: P     } },

  // ── Pantry / desserts / other ─────────────────────────────────────────────
  { name: 'Pasta',                category: 'item',   hrs: { UX: d(7),    OX: d(3),   IX: d(2)  } },
  { name: 'Lava Cakes',           category: 'item',   hrs: { UX: d(10),   OX: d(7),   IX: d(2)  } },
  { name: 'Cookie Brownie',       category: 'item',   hrs: { UX: d(10),   OX: d(7),   IX: d(2)  } },
  // Cinna Magic IX: "keep prepped" → same as OX (4 days)
  { name: 'Cinna Magic',          category: 'item',   hrs: { UX: d(90),   OX: d(4),   IX: d(4)  } },
  { name: 'Cornmeal',             category: 'item',   hrs: { UX: mo(3),   OX: d(30),  IX: P     } },
  // Powdered Sugar IX: "keep prepped" → same as OX (30 days)
  { name: 'Powdered Sugar',       category: 'item',   hrs: { UX: yr(1),   OX: d(30),  IX: d(30) } },
  { name: 'Pineapple',            category: 'item',   hrs: { UX: P,       OX: d(7),   IX: d(2)  } },
  { name: 'Soda',                 category: 'item',   hrs: { UX: P,       OX: P,      IX: P     } },
]

export interface ImportResult {
  items:   QuickListEntry[]
  cats:    CategoryDef[]
  added:   number
  updated: number
  skipped: number
}

/**
 * Upsert the Shelf Life Guide seed items into the user's existing quick items.
 * - New items are added.
 * - Existing items (matched by name) have their hrs updated if they differ,
 *   so re-running import picks up any corrections without wiping custom items.
 * - The 'cheese' / 'dough' categories are added if missing and deduped.
 */
export function importShelfLifeItems(
  existingItems: QuickListEntry[],
  existingCats:  CategoryDef[],
): ImportResult {
  const seenCat = new Set<string>()
  const cats: CategoryDef[] = []
  for (const c of [...existingCats, ...SHELF_LIFE_CATS]) {
    if (seenCat.has(c.id)) continue
    seenCat.add(c.id)
    cats.push(c)
  }

  const items = [...existingItems]
  let added = 0, updated = 0, skipped = 0, seq = 0

  for (const seed of SHELF_LIFE_ITEMS) {
    const key = seed.name.trim().toLowerCase()
    const idx = items.findIndex(
      i => i.type === 'item' && i.name.trim().toLowerCase() === key,
    )
    if (idx !== -1) {
      const existing = items[idx] as QuickSingleItem
      if (JSON.stringify(existing.hrs) !== JSON.stringify(seed.hrs)) {
        items[idx] = { ...existing, hrs: seed.hrs }
        updated++
      } else {
        skipped++
      }
      continue
    }
    items.push({ id: `sl-${Date.now()}-${seq++}`, name: seed.name, type: 'item', hrs: seed.hrs, category: seed.category })
    added++
  }

  return { items, cats, added, updated, skipped }
}
