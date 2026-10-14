import { parseMenus, type MenuDefinition } from '../scripting/menus'
import type { CustomMenuDef } from '../shared/custom-menus'

export type { CustomMenuDef }

export interface CustomMenuValidation {
  ok: boolean
  errors: string[]
  menus: MenuDefinition[]
}

/** Validate a user menu definition (text editor path). */
export function validateCustomMenuDef(def: CustomMenuDef): CustomMenuValidation {
  const errors: string[] = []
  if (!def.name.trim()) errors.push('Menu name is required')
  if (!def.target.trim()) errors.push('Menu target is required')
  const src = def.source.trim()
  if (!src) {
    errors.push('Menu source is empty')
    return { ok: false, errors, menus: [] }
  }

  const wrapped = /^menu\s+/i.test(src) ? src : `menu ${def.target} {\n${src}\n}`

  const { menus, errors: parseErrors } = parseMenus(wrapped)
  for (const e of parseErrors) errors.push(`L${e.line}: ${e.message}`)
  if (!menus.length && !parseErrors.length) errors.push('No menu block produced')
  if (menus.length && menus[0]!.items.length === 0) {
    errors.push('Menu has no items')
  }
  return { ok: errors.length === 0, errors, menus }
}

export function validateAllCustomMenus(defs: CustomMenuDef[]): {
  ok: boolean
  errors: { id: string; messages: string[] }[]
} {
  const errors: { id: string; messages: string[] }[] = []
  for (const d of defs) {
    const v = validateCustomMenuDef(d)
    if (!v.ok) errors.push({ id: d.id, messages: v.errors })
  }
  return { ok: errors.length === 0, errors }
}
