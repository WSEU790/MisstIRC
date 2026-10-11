/** Structured AST for the MisstIRC scripting subset (not string-eval). */

export type ScriptNode =
  | ScriptFile
  | AliasDecl
  | EventDecl
  | RawDecl
  | Statement
  | Expr

export interface ScriptFile {
  type: 'ScriptFile'
  body: TopLevel[]
}

export type TopLevel = AliasDecl | EventDecl | RawDecl | MenuDecl

/** Scaffold-only menu declaration (see menus.ts for full tree). */
export interface MenuDecl {
  type: 'MenuDecl'
  target: string
  /** Opaque body lines preserved for the menu scaffold */
  bodyText: string
  line: number
}

export interface AliasDecl {
  type: 'AliasDecl'
  name: string
  body: Statement[]
  line: number
}

export interface EventDecl {
  type: 'EventDecl'
  /** e.g. TEXT, JOIN, PART, PRIVMSG, NOTICE, CONNECT, DISCONNECT */
  event: string
  /** mIRC level prefix like `*` or `#` channel match */
  match: string
  /** Optional match text for TEXT events */
  textMatch?: string
  /** Optional channel/target pattern */
  targetMatch?: string
  body: Statement[]
  line: number
}

export interface RawDecl {
  type: 'RawDecl'
  numeric: string
  match: string
  body: Statement[]
  line: number
}

export type Statement =
  | BlockStmt
  | CommandStmt
  | IfStmt
  | WhileStmt
  | VarStmt
  | ReturnStmt
  | HaltStmt

export interface BlockStmt {
  type: 'BlockStmt'
  body: Statement[]
}

export interface CommandStmt {
  type: 'CommandStmt'
  name: string
  args: Expr[]
  rawArgs: string
  line: number
}

export interface IfStmt {
  type: 'IfStmt'
  test: Expr
  consequent: Statement[]
  alternate?: Statement[]
  line: number
}

export interface WhileStmt {
  type: 'WhileStmt'
  test: Expr
  body: Statement[]
  line: number
}

export interface VarStmt {
  type: 'VarStmt'
  name: string
  value: Expr
  line: number
}

export interface ReturnStmt {
  type: 'ReturnStmt'
  value?: Expr
  line: number
}

export interface HaltStmt {
  type: 'HaltStmt'
  line: number
}

export type Expr =
  | StringExpr
  | NumberExpr
  | IdentExpr
  | VarExpr
  | BinaryExpr
  | UnaryExpr
  | CallExpr

export interface StringExpr {
  type: 'StringExpr'
  value: string
}

export interface NumberExpr {
  type: 'NumberExpr'
  value: number
}

export interface IdentExpr {
  type: 'IdentExpr'
  /** Identifiers like $nick, $1, $chan */
  name: string
}

export interface VarExpr {
  type: 'VarExpr'
  /** %var */
  name: string
}

export interface BinaryExpr {
  type: 'BinaryExpr'
  op: '==' | '!=' | '<' | '>' | '<=' | '>=' | '&&' | '||' | '+' | '-' | '*' | '/' | 'isin' | 'isnum'
  left: Expr
  right: Expr
}

export interface UnaryExpr {
  type: 'UnaryExpr'
  op: '!' | '-'
  argument: Expr
}

export interface CallExpr {
  type: 'CallExpr'
  callee: string
  args: Expr[]
}

export interface ParseError {
  line: number
  column: number
  message: string
}
