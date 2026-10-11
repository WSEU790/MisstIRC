/**
 * Documented runtime bounds for long sessions (Phase 8).
 * Keep UI / search indexes from unbounded growth.
 */

/** Live search index in ConnectionManager */
export const MESSAGE_INDEX_MAX = 5_000

/** Renderer in-memory transcript retained for the active session */
export const RENDERER_MESSAGE_MAX = 2_000

/** Recent script execution errors retained per script */
export const SCRIPT_EXEC_ERROR_MAX = 20

/** IRC line max length (bytes) before truncate/reject at connection layer */
export const IRC_LINE_MAX = 512

/** Default CTCP flood replies per 10s window */
export const CTCP_FLOOD_DEFAULT = 5
