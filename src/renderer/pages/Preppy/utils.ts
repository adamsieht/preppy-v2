import type { TemplateHrs, CategoryDef, QuickListEntry } from './types'
import { CATS_KEY, ITEMS_KEY, ITEM_CATEGORIES } from './constants'

export function loadStored<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') }
  catch { return [] }
}

export function persist(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function migrateHrs(raw: unknown): TemplateHrs {
  if (typeof raw === 'number') return { IX: raw, OX: raw, UX: raw }
  if (raw && typeof raw === 'object' && 'IX' in raw) return raw as TemplateHrs
  return { IX: 4, OX: 4, UX: 4 }
}

export function loadUserCats(): CategoryDef[] {
  try { return JSON.parse(localStorage.getItem(CATS_KEY) ?? '[]') }
  catch { return [] }
}

export function loadItems(): QuickListEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ITEMS_KEY) ?? '[]') as Array<Record<string, unknown>>
    return raw.map(item => {
      if (item['type'] === 'bundle' && Array.isArray(item['entries'])) {
        const entries = (item['entries'] as Array<Record<string, unknown>>).map(e => ({
          hrs:  migrateHrs(e['hrs']),
          qty:  (e['qty'] as number) ?? 1,
          name: e['name'] as string | undefined,
        }))
        return { id: item['id'] as string, name: item['name'] as string, type: 'bundle' as const, entries }
      }
      return {
        id:       item['id'] as string,
        name:     item['name'] as string,
        type:     'item' as const,
        hrs:      migrateHrs(item['hrs']),
        category: (item['category'] as string | undefined) ?? 'item',
      }
    })
  } catch { return [] }
}

export function fmtDuration(hrs: number): string {
  if (hrs < 24) return `${hrs} hr`
  const d = hrs / 24
  return `${d} day${d !== 1 ? 's' : ''}`
}

export function autoLabel(hrs: number): string {
  if (hrs < 24) return `${hrs} HR`
  const d = hrs / 24
  return Number.isInteger(d) ? `${d} DAY` : `${hrs} HR`
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export function getCat(id: string, extra: CategoryDef[] = []): CategoryDef {
  return [...extra, ...ITEM_CATEGORIES].find(c => c.id === id) ?? ITEM_CATEGORIES[0]
}
