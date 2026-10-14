/** Custom menu definition shape (Phase 7). Validation lives in services/custom-menus. */

export interface CustomMenuDef {
  id: string
  name: string
  /** channel | nick | query | status | menubar | nicklist */
  target: string
  /** Text menu source (mIRC-style menu block or body lines) */
  source: string
}
