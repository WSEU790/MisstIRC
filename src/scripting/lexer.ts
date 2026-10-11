export type TokenKind =
  | 'EOF'
  | 'NEWLINE'
  | 'IDENT'
  | 'NUMBER'
  | 'STRING'
  | 'VAR'
  | 'DOLLAR'
  | 'LBRACE'
  | 'RBRACE'
  | 'LPAREN'
  | 'RPAREN'
  | 'COLON'
  | 'EQ'
  | 'EQEQ'
  | 'NE'
  | 'LT'
  | 'GT'
  | 'LE'
  | 'GE'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'PLUS'
  | 'MINUS'
  | 'STAR'
  | 'SLASH'
  | 'COMMA'
  | 'KW_ALIAS'
  | 'KW_ON'
  | 'KW_RAW'
  | 'KW_IF'
  | 'KW_ELSE'
  | 'KW_WHILE'
  | 'KW_VAR'
  | 'KW_RETURN'
  | 'KW_HALT'
  | 'KW_GOTO'
  | 'TEXT'

export interface Token {
  kind: TokenKind
  value: string
  line: number
  column: number
}

const KEYWORDS: Record<string, TokenKind> = {
  alias: 'KW_ALIAS',
  on: 'KW_ON',
  raw: 'KW_RAW',
  if: 'KW_IF',
  else: 'KW_ELSE',
  while: 'KW_WHILE',
  var: 'KW_VAR',
  return: 'KW_RETURN',
  halt: 'KW_HALT',
  goto: 'KW_GOTO'
}

/** Lex a MisstIRC script source into tokens. Comments (`;`) strip to EOL. */
export function lex(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let line = 1
  let col = 1

  const peek = (n = 0): string => source[i + n] ?? ''
  const advance = (): string => {
    const ch = source[i++] ?? ''
    if (ch === '\n') {
      line += 1
      col = 1
    } else col += 1
    return ch
  }

  const push = (kind: TokenKind, value: string, startLine: number, startCol: number): void => {
    tokens.push({ kind, value, line: startLine, column: startCol })
  }

  while (i < source.length) {
    const startLine = line
    const startCol = col
    const ch = peek()

    if (ch === '\r') {
      advance()
      continue
    }
    if (ch === '\n') {
      advance()
      push('NEWLINE', '\n', startLine, startCol)
      continue
    }
    if (ch === ' ' || ch === '\t') {
      advance()
      continue
    }
    if (ch === ';') {
      while (peek() && peek() !== '\n') advance()
      continue
    }
    if (ch === '{') {
      advance()
      push('LBRACE', '{', startLine, startCol)
      continue
    }
    if (ch === '}') {
      advance()
      push('RBRACE', '}', startLine, startCol)
      continue
    }
    if (ch === '(') {
      advance()
      push('LPAREN', '(', startLine, startCol)
      continue
    }
    if (ch === ')') {
      advance()
      push('RPAREN', ')', startLine, startCol)
      continue
    }
    if (ch === ':') {
      advance()
      push('COLON', ':', startLine, startCol)
      continue
    }
    if (ch === ',') {
      advance()
      push('COMMA', ',', startLine, startCol)
      continue
    }
    if (ch === '"' || ch === "'") {
      const quote = advance()
      let value = ''
      while (peek() && peek() !== quote && peek() !== '\n') value += advance()
      if (peek() === quote) advance()
      push('STRING', value, startLine, startCol)
      continue
    }
    if (ch === '%' && /[A-Za-z_]/.test(peek(1))) {
      advance()
      let name = '%'
      while (/[A-Za-z0-9_.]/.test(peek())) name += advance()
      push('VAR', name, startLine, startCol)
      continue
    }
    if (ch === '$') {
      advance()
      let name = '$'
      if (/[0-9]/.test(peek())) {
        while (/[0-9-]/.test(peek())) name += advance()
      } else {
        while (/[A-Za-z0-9_]/.test(peek())) name += advance()
      }
      push('DOLLAR', name, startLine, startCol)
      continue
    }
    if (ch === '=' && peek(1) === '=') {
      advance()
      advance()
      push('EQEQ', '==', startLine, startCol)
      continue
    }
    if (ch === '!' && peek(1) === '=') {
      advance()
      advance()
      push('NE', '!=', startLine, startCol)
      continue
    }
    if (ch === '<' && peek(1) === '=') {
      advance()
      advance()
      push('LE', '<=', startLine, startCol)
      continue
    }
    if (ch === '>' && peek(1) === '=') {
      advance()
      advance()
      push('GE', '>=', startLine, startCol)
      continue
    }
    if (ch === '&' && peek(1) === '&') {
      advance()
      advance()
      push('AND', '&&', startLine, startCol)
      continue
    }
    if (ch === '|' && peek(1) === '|') {
      advance()
      advance()
      push('OR', '||', startLine, startCol)
      continue
    }
    if (ch === '=') {
      advance()
      push('EQ', '=', startLine, startCol)
      continue
    }
    if (ch === '!') {
      advance()
      push('NOT', '!', startLine, startCol)
      continue
    }
    if (ch === '<') {
      advance()
      push('LT', '<', startLine, startCol)
      continue
    }
    if (ch === '>') {
      advance()
      push('GT', '>', startLine, startCol)
      continue
    }
    if (ch === '+') {
      advance()
      push('PLUS', '+', startLine, startCol)
      continue
    }
    if (ch === '-') {
      advance()
      push('MINUS', '-', startLine, startCol)
      continue
    }
    if (ch === '*') {
      advance()
      push('STAR', '*', startLine, startCol)
      continue
    }
    if (ch === '/') {
      advance()
      push('SLASH', '/', startLine, startCol)
      continue
    }
    if (/[0-9]/.test(ch)) {
      let value = ''
      while (/[0-9.]/.test(peek())) value += advance()
      push('NUMBER', value, startLine, startCol)
      continue
    }
    if (/[A-Za-z_#&+@.~]/.test(ch)) {
      let value = ''
      while (peek() && !/[\s{}():,;=<>!&|"']/.test(peek())) value += advance()
      const lower = value.toLowerCase()
      if (KEYWORDS[lower]) push(KEYWORDS[lower]!, value, startLine, startCol)
      else push('IDENT', value, startLine, startCol)
      continue
    }
    // Fallback: treat as text fragment
    advance()
    push('TEXT', ch, startLine, startCol)
  }

  push('EOF', '', line, col)
  return tokens
}
