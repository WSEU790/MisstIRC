import type {
  AliasDecl,
  EventDecl,
  Expr,
  MenuDecl,
  ParseError,
  RawDecl,
  ScriptFile,
  Statement,
  TopLevel
} from './ast'
import { lex, type Token, type TokenKind } from './lexer'

export interface ParseResult {
  file: ScriptFile | null
  errors: ParseError[]
}

/**
 * Parse a MisstIRC scripting subset into a structured AST.
 * Supports alias/on/raw top-levels, if/else/while/var/halt/return, and command lines.
 */
export function parseScript(source: string): ParseResult {
  const tokens = lex(source)
  const errors: ParseError[] = []
  let pos = 0

  const at = (): Token => tokens[pos] ?? tokens[tokens.length - 1]!
  const check = (kind: TokenKind): boolean => at().kind === kind
  const match = (...kinds: TokenKind[]): Token | null => {
    if (kinds.includes(at().kind)) return tokens[pos++]!
    return null
  }
  const expect = (kind: TokenKind, message: string): Token | null => {
    if (check(kind)) return tokens[pos++]!
    const t = at()
    errors.push({ line: t.line, column: t.column, message })
    return null
  }
  const skipNewlines = (): void => {
    while (check('NEWLINE')) pos += 1
  }

  function parseFile(): ScriptFile {
    const body: TopLevel[] = []
    skipNewlines()
    while (!check('EOF')) {
      skipNewlines()
      if (check('EOF')) break
      const item = parseTopLevel()
      if (item) body.push(item)
      else {
        // recover: skip to next newline/top-level keyword
        while (
          !check('EOF') &&
          !check('NEWLINE') &&
          !check('KW_ALIAS') &&
          !check('KW_ON') &&
          !check('KW_RAW') &&
          !check('KW_MENU')
        ) {
          pos += 1
        }
        skipNewlines()
      }
    }
    return { type: 'ScriptFile', body }
  }

  function parseTopLevel(): TopLevel | null {
    if (check('KW_ALIAS')) return parseAlias()
    if (check('KW_ON')) return parseOn()
    if (check('KW_RAW')) return parseRaw()
    if (check('KW_MENU')) return parseMenu()
    const t = at()
    errors.push({
      line: t.line,
      column: t.column,
      message: `Expected alias/on/raw/menu, found ${t.kind} (${t.value})`
    })
    pos += 1
    return null
  }

  function parseMenu(): MenuDecl | null {
    // Body is consumed as raw text for the menu scaffold (menus.ts does structure).
    const start = expect('KW_MENU', 'Expected menu')
    if (!start) return null
    const targetTok = match('IDENT', 'STAR', 'STRING')
    const target = targetTok?.value ?? 'unknown'
    skipNewlines()
    const bodyParts: string[] = []
    if (match('LBRACE')) {
      let depth = 1
      while (!check('EOF') && depth > 0) {
        if (check('LBRACE')) depth += 1
        if (check('RBRACE')) {
          depth -= 1
          if (depth === 0) {
            pos += 1
            break
          }
        }
        bodyParts.push(at().value)
        pos += 1
      }
    } else {
      errors.push({
        line: at().line,
        column: at().column,
        message: 'Expected { after menu target'
      })
    }
    return {
      type: 'MenuDecl',
      target,
      bodyText: bodyParts.join(' '),
      line: start.line
    }
  }

  function parseAlias(): AliasDecl | null {
    const start = expect('KW_ALIAS', 'Expected alias')
    if (!start) return null
    const nameTok = expect('IDENT', 'Expected alias name')
    if (!nameTok) return null
    skipNewlines()
    const body = parseBlockOrSingle()
    return { type: 'AliasDecl', name: nameTok.value, body, line: start.line }
  }

  function parseOn(): EventDecl | null {
    // on <level>:<EVENT>:[text]:[target]:{ body }   OR simplified on *:TEXT:#:{ }
    const start = expect('KW_ON', 'Expected on')
    if (!start) return null
    // level (* or number)
    const level = match('IDENT', 'STAR', 'NUMBER')
    expect('COLON', 'Expected : after event level')
    const eventTok = expect('IDENT', 'Expected event name')
    if (!eventTok) return null
    let textMatch: string | undefined
    let targetMatch: string | undefined
    if (match('COLON')) {
      // optional text and/or target: on *:TEXT:hi*:#:{  OR  on *:KICK:#:{  OR  on *:NICK:{
      const parts: string[] = []
      while (!check('COLON') && !check('LBRACE') && !check('NEWLINE') && !check('EOF')) {
        parts.push(at().value)
        pos += 1
      }
      const first = parts.join('') || undefined
      if (match('COLON')) {
        const tparts: string[] = []
        while (!check('LBRACE') && !check('NEWLINE') && !check('EOF') && !check('COLON')) {
          tparts.push(at().value)
          pos += 1
        }
        // trailing colon before brace in mIRC: on *:TEXT:hi:#: {
        if (match('COLON')) {
          /* eat */
        }
        const second = tparts.join('') || undefined
        if (second) {
          textMatch = first
          targetMatch = second
        } else if (first === '#' || first === '&' || first === '*' || first?.startsWith('#') || first?.startsWith('&')) {
          // on *:KICK:#:{ — sole match is the channel target
          targetMatch = first
        } else {
          textMatch = first
        }
      } else if (first === '#' || first === '&' || first === '*' || first?.startsWith('#') || first?.startsWith('&')) {
        targetMatch = first
      } else {
        textMatch = first
      }
      if (match('COLON')) {
        /* eat final */
      }
    }
    skipNewlines()
    const body = parseBlockOrSingle()
    return {
      type: 'EventDecl',
      event: eventTok.value.toUpperCase(),
      match: level?.value ?? '*',
      textMatch,
      targetMatch,
      body,
      line: start.line
    }
  }

  function parseRaw(): RawDecl | null {
    const start = expect('KW_RAW', 'Expected raw')
    if (!start) return null
    const num = expect('NUMBER', 'Expected numeric') ?? expect('IDENT', 'Expected numeric')
    if (!num) return null
    expect('COLON', 'Expected :')
    const matchTok = match('STAR', 'IDENT', 'STRING')
    expect('COLON', 'Expected : before body')
    skipNewlines()
    const body = parseBlockOrSingle()
    return {
      type: 'RawDecl',
      numeric: num.value,
      match: matchTok?.value ?? '*',
      body,
      line: start.line
    }
  }

  function parseBlockOrSingle(): Statement[] {
    if (match('LBRACE')) {
      const body: Statement[] = []
      skipNewlines()
      while (!check('RBRACE') && !check('EOF')) {
        skipNewlines()
        if (check('RBRACE')) break
        const stmt = parseStatement()
        if (stmt) body.push(stmt)
        else pos += 1
        skipNewlines()
      }
      expect('RBRACE', 'Expected }')
      return body
    }
    const stmt = parseStatement()
    return stmt ? [stmt] : []
  }

  function parseStatement(): Statement | null {
    skipNewlines()
    if (check('KW_IF')) return parseIf()
    if (check('KW_WHILE')) return parseWhile()
    if (check('KW_VAR')) return parseVar()
    if (check('KW_RETURN')) {
      const t = tokens[pos++]!
      let value: Expr | undefined
      if (!check('NEWLINE') && !check('RBRACE') && !check('EOF')) value = parseExpr()
      return { type: 'ReturnStmt', value, line: t.line }
    }
    if (check('KW_HALT')) {
      const t = tokens[pos++]!
      return { type: 'HaltStmt', line: t.line }
    }
    if (check('LBRACE')) {
      return { type: 'BlockStmt', body: parseBlockOrSingle() }
    }
    // command line: ident + rest as rawArgs / expressions
    if (check('IDENT') || check('SLASH')) {
      if (check('SLASH')) pos += 1
      const nameTok = expect('IDENT', 'Expected command')
      if (!nameTok) return null
      const argStart = pos
      const args: Expr[] = []
      const rawParts: string[] = []
      while (!check('NEWLINE') && !check('RBRACE') && !check('EOF') && !check('KW_ELSE')) {
        if (check('VAR') || check('DOLLAR') || check('NUMBER') || check('STRING') || check('LPAREN')) {
          args.push(parseExpr())
          rawParts.push('?')
        } else {
          rawParts.push(at().value)
          pos += 1
        }
      }
      // Rebuild raw args from tokens between
      const rawArgs = tokens
        .slice(argStart, pos)
        .map((t) => t.value)
        .join(' ')
        .trim()
      return {
        type: 'CommandStmt',
        name: nameTok.value.toLowerCase(),
        args,
        rawArgs,
        line: nameTok.line
      }
    }
    return null
  }

  function parseIf(): Statement {
    const t = expect('KW_IF', 'if')!
    expect('LPAREN', 'Expected (')
    const test = parseExpr()
    expect('RPAREN', 'Expected )')
    skipNewlines()
    const consequent = parseBlockOrSingle()
    skipNewlines()
    let alternate: Statement[] | undefined
    if (match('KW_ELSE')) {
      skipNewlines()
      alternate = parseBlockOrSingle()
    }
    return { type: 'IfStmt', test, consequent, alternate, line: t.line }
  }

  function parseWhile(): Statement {
    const t = expect('KW_WHILE', 'while')!
    expect('LPAREN', 'Expected (')
    const test = parseExpr()
    expect('RPAREN', 'Expected )')
    skipNewlines()
    const body = parseBlockOrSingle()
    return { type: 'WhileStmt', test, body, line: t.line }
  }

  function parseVar(): Statement {
    const t = expect('KW_VAR', 'var')!
    const name = expect('VAR', 'Expected %variable')
    match('EQ')
    const value = parseExpr()
    return {
      type: 'VarStmt',
      name: name?.value ?? '%_',
      value,
      line: t.line
    }
  }

  function parseExpr(): Expr {
    return parseOr()
  }

  function parseOr(): Expr {
    let left = parseAnd()
    while (match('OR')) {
      const right = parseAnd()
      left = { type: 'BinaryExpr', op: '||', left, right }
    }
    return left
  }

  function parseAnd(): Expr {
    let left = parseEquality()
    while (match('AND')) {
      const right = parseEquality()
      left = { type: 'BinaryExpr', op: '&&', left, right }
    }
    return left
  }

  function parseEquality(): Expr {
    let left = parseCompare()
    while (true) {
      if (match('EQEQ')) left = { type: 'BinaryExpr', op: '==', left, right: parseCompare() }
      else if (match('NE')) left = { type: 'BinaryExpr', op: '!=', left, right: parseCompare() }
      else if (check('IDENT') && at().value.toLowerCase() === 'isin') {
        pos += 1
        left = { type: 'BinaryExpr', op: 'isin', left, right: parseCompare() }
      } else if (check('IDENT') && at().value.toLowerCase() === 'isnum') {
        pos += 1
        left = { type: 'BinaryExpr', op: 'isnum', left, right: { type: 'NumberExpr', value: 0 } }
      } else break
    }
    return left
  }

  function parseCompare(): Expr {
    let left = parseTerm()
    while (true) {
      if (match('LT')) left = { type: 'BinaryExpr', op: '<', left, right: parseTerm() }
      else if (match('GT')) left = { type: 'BinaryExpr', op: '>', left, right: parseTerm() }
      else if (match('LE')) left = { type: 'BinaryExpr', op: '<=', left, right: parseTerm() }
      else if (match('GE')) left = { type: 'BinaryExpr', op: '>=', left, right: parseTerm() }
      else break
    }
    return left
  }

  function parseTerm(): Expr {
    let left = parseFactor()
    while (true) {
      if (match('PLUS')) left = { type: 'BinaryExpr', op: '+', left, right: parseFactor() }
      else if (match('MINUS')) left = { type: 'BinaryExpr', op: '-', left, right: parseFactor() }
      else break
    }
    return left
  }

  function parseFactor(): Expr {
    let left = parseUnary()
    while (true) {
      if (match('STAR')) left = { type: 'BinaryExpr', op: '*', left, right: parseUnary() }
      else if (match('SLASH')) left = { type: 'BinaryExpr', op: '/', left, right: parseUnary() }
      else break
    }
    return left
  }

  function parseUnary(): Expr {
    if (match('NOT')) return { type: 'UnaryExpr', op: '!', argument: parseUnary() }
    if (match('MINUS')) return { type: 'UnaryExpr', op: '-', argument: parseUnary() }
    return parsePrimary()
  }

  function parsePrimary(): Expr {
    if (check('NUMBER')) {
      const t = tokens[pos++]!
      return { type: 'NumberExpr', value: Number(t.value) }
    }
    if (check('STRING')) {
      const t = tokens[pos++]!
      return { type: 'StringExpr', value: t.value }
    }
    if (check('VAR')) {
      const t = tokens[pos++]!
      return { type: 'VarExpr', name: t.value }
    }
    if (check('DOLLAR')) {
      const t = tokens[pos++]!
      if (match('LPAREN')) {
        const args: Expr[] = []
        if (!check('RPAREN')) {
          args.push(parseExpr())
          while (match('COMMA')) args.push(parseExpr())
        }
        expect('RPAREN', 'Expected )')
        return { type: 'CallExpr', callee: t.value, args }
      }
      return { type: 'IdentExpr', name: t.value }
    }
    if (check('IDENT')) {
      const t = tokens[pos++]!
      return { type: 'StringExpr', value: t.value }
    }
    if (match('LPAREN')) {
      const e = parseExpr()
      expect('RPAREN', 'Expected )')
      return e
    }
    const t = at()
    errors.push({ line: t.line, column: t.column, message: `Unexpected token in expression: ${t.kind}` })
    pos += 1
    return { type: 'StringExpr', value: '' }
  }

  try {
    const file = parseFile()
    return { file, errors }
  } catch (err) {
    errors.push({
      line: at().line,
      column: at().column,
      message: err instanceof Error ? err.message : String(err)
    })
    return { file: null, errors }
  }
}
