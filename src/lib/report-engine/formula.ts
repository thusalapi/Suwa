/**
 * Calculated results. A result row may define a `formula` — plain arithmetic over other rows'
 * keys, e.g. `wbc * neut / 100` or `hb * 100 / pcv` — instead of being entered by hand. The
 * grammar is deliberately tiny (numbers, row keys, + - * /, parentheses, unary minus) and is
 * parsed here, never `eval`'d, so a template can't run code.
 *
 * Like flags, calculated values are computed on entry and STORED; the render path never
 * recomputes them, so an issued report stays reproducible.
 */

export type Expr =
  | { kind: "num"; value: number }
  | { kind: "ref"; key: string }
  | { kind: "neg"; arg: Expr }
  | { kind: "bin"; op: "+" | "-" | "*" | "/"; left: Expr; right: Expr };

export class FormulaError extends Error {}

const TOKEN = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([a-z][a-z0-9_]*)|([-+*/()]))/y;

function tokenize(src: string): string[] {
  const tokens: string[] = [];
  TOKEN.lastIndex = 0;
  let pos = 0;
  while (pos < src.length) {
    if (/^\s*$/.test(src.slice(pos))) break;
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(src);
    if (!m) throw new FormulaError(`unexpected character "${src.slice(pos).trim()[0]}"`);
    tokens.push(m[1] ?? m[2] ?? m[3]);
    pos = TOKEN.lastIndex;
  }
  return tokens;
}

/** Parse a formula string into an expression tree. Throws FormulaError on bad syntax. */
export function parseFormula(src: string): Expr {
  const tokens = tokenize(src);
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];

  // expr := term (("+" | "-") term)* ; term := unary (("*" | "/") unary)* ; unary := "-" unary | atom
  const expr = (): Expr => {
    let left = term();
    while (peek() === "+" || peek() === "-") {
      const op = next() as "+" | "-";
      left = { kind: "bin", op, left, right: term() };
    }
    return left;
  };
  const term = (): Expr => {
    let left = unary();
    while (peek() === "*" || peek() === "/") {
      const op = next() as "*" | "/";
      left = { kind: "bin", op, left, right: unary() };
    }
    return left;
  };
  const unary = (): Expr => (peek() === "-" ? (next(), { kind: "neg", arg: unary() }) : atom());
  const atom = (): Expr => {
    const tok = next();
    if (tok === undefined) throw new FormulaError("formula ends unexpectedly");
    if (tok === "(") {
      const inner = expr();
      if (next() !== ")") throw new FormulaError("missing )");
      return inner;
    }
    if (/^[\d.]/.test(tok)) return { kind: "num", value: Number(tok) };
    if (/^[a-z]/.test(tok)) return { kind: "ref", key: tok };
    throw new FormulaError(`unexpected "${tok}"`);
  };

  if (tokens.length === 0) throw new FormulaError("formula is empty");
  const tree = expr();
  if (i < tokens.length) throw new FormulaError(`unexpected "${tokens[i]}"`);
  return tree;
}

/** The row keys a formula reads. */
export function formulaRefs(expr: Expr): string[] {
  switch (expr.kind) {
    case "num":
      return [];
    case "ref":
      return [expr.key];
    case "neg":
      return formulaRefs(expr.arg);
    case "bin":
      return [...formulaRefs(expr.left), ...formulaRefs(expr.right)];
  }
}

/**
 * Evaluate against known values. Returns null when any referenced value is missing or the
 * result isn't a finite number (e.g. divide by zero) — the row is then left blank.
 */
export function evaluateFormula(expr: Expr, values: Record<string, number>): number | null {
  const ev = (e: Expr): number => {
    switch (e.kind) {
      case "num":
        return e.value;
      case "ref":
        return e.key in values ? values[e.key] : NaN;
      case "neg":
        return -ev(e.arg);
      case "bin": {
        const l = ev(e.left);
        const r = ev(e.right);
        return e.op === "+" ? l + r : e.op === "-" ? l - r : e.op === "*" ? l * r : l / r;
      }
    }
  };
  const n = ev(expr);
  return Number.isFinite(n) ? n : null;
}

/** Round to a fixed number of decimal places (half away from zero, as a lab would). */
export function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return (Math.sign(n) * Math.round(Math.abs(n) * f + Number.EPSILON)) / f;
}
