/**
 * Evaluate a restricted arithmetic expression for $calc.
 * Allows digits, whitespace, + - * / ( ) and decimal points only.
 */

export function safeCalc(expr: string): number {
  const cleaned = expr.replace(/\s+/g, '')
  if (!cleaned) return 0
  if (!/^[0-9+\-*/().]+$/.test(cleaned)) {
    throw new Error('$calc: invalid characters')
  }
  // Disallow consecutive operators (except unary minus after ( or start)
  if (/[*/]{2,}/.test(cleaned) || /\(\)/.test(cleaned)) {
    throw new Error('$calc: malformed expression')
  }
  let i = 0
  const peek = (): string => cleaned[i] ?? ''
  const consume = (): string => cleaned[i++] ?? ''

  function parseExpr(): number {
    let v = parseTerm()
    while (peek() === '+' || peek() === '-') {
      const op = consume()
      const r = parseTerm()
      v = op === '+' ? v + r : v - r
    }
    return v
  }

  function parseTerm(): number {
    let v = parseFactor()
    while (peek() === '*' || peek() === '/') {
      const op = consume()
      const r = parseFactor()
      v = op === '*' ? v * r : r === 0 ? 0 : v / r
    }
    return v
  }

  function parseFactor(): number {
    if (peek() === '+') {
      consume()
      return parseFactor()
    }
    if (peek() === '-') {
      consume()
      return -parseFactor()
    }
    if (peek() === '(') {
      consume()
      const v = parseExpr()
      if (peek() !== ')') throw new Error('$calc: missing )')
      consume()
      return v
    }
    return parseNumber()
  }

  function parseNumber(): number {
    const start = i
    while (/[0-9.]/.test(peek())) consume()
    if (start === i) throw new Error('$calc: expected number')
    const n = Number(cleaned.slice(start, i))
    if (Number.isNaN(n)) throw new Error('$calc: invalid number')
    return n
  }

  const result = parseExpr()
  if (i !== cleaned.length) throw new Error('$calc: trailing input')
  if (!Number.isFinite(result)) return 0
  return result
}
