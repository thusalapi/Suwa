/**
 * Calculated results. A result row may define a `formula` — plain arithmetic over other rows'
 * keys, e.g. `wbc * neut / 100` or `hb * 100 / pcv` — instead of being entered by hand. The
 * grammar is deliberately tiny (numbers, row keys, + - * / ^, parentheses, unary minus, and the
 * functions min(a, b, …) / max(a, b, …) / trunc(x, places)) and is parsed here, never `eval`'d, so a template can't
 * run code.
 *
 * Formulas may also read the patient (PATIENT_VARS): `age` in years, and `male` / `female`
 * (1 or 0). E.g. a sex-specific constant: `(0.9 - 0.2 * female)` is 0.9 for men, 0.7 for women.
 *
 * Like flags, calculated values are computed on entry and STORED; the render path never
 * recomputes them, so an issued report stays reproducible.
 */

export type Expr =
  | { kind: "num"; value: number }
  | { kind: "ref"; key: string }
  | { kind: "neg"; arg: Expr }
  | { kind: "bin"; op: "+" | "-" | "*" | "/" | "^"; left: Expr; right: Expr }
  | { kind: "call"; fn: FormulaFn; args: Expr[] };

/** The only functions a formula may call. */
export const FORMULA_FNS = ["min", "max", "trunc"] as const;
export type FormulaFn = (typeof FORMULA_FNS)[number];

/** Patient values a formula can read (a row key of the same name takes precedence). */
export const PATIENT_VARS = ["age", "male", "female"] as const;

/** Formula variables from a report's patient_info: age, and male/female as 1/0 when sex is known. */
export function patientVars(info: Record<string, unknown> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  const age = Number(info?.age);
  if (info?.age != null && info.age !== "" && Number.isFinite(age)) out.age = age;
  const g = String(info?.gender ?? "")
    .trim()
    .toLowerCase();
  if (g === "male" || g === "female") {
    out.male = g === "male" ? 1 : 0;
    out.female = g === "female" ? 1 : 0;
  }
  return out;
}

export class FormulaError extends Error {}

const TOKEN = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([a-z][a-z0-9_]*)|([-+*/^(),]))/y;

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

  // expr := term (("+" | "-") term)* ; term := unary (("*" | "/") unary)* ;
  // unary := "-" unary | power ; power := atom ("^" unary)?   (right-assoc; -a^2 = -(a^2))
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
  const unary = (): Expr => (peek() === "-" ? (next(), { kind: "neg", arg: unary() }) : power());
  const power = (): Expr => {
    const base = atom();
    if (peek() !== "^") return base;
    next();
    return { kind: "bin", op: "^", left: base, right: unary() };
  };
  const atom = (): Expr => {
    const tok = next();
    if (tok === undefined) throw new FormulaError("formula ends unexpectedly");
    if (tok === "(") {
      const inner = expr();
      if (next() !== ")") throw new FormulaError("missing )");
      return inner;
    }
    if (/^[\d.]/.test(tok)) return { kind: "num", value: Number(tok) };
    if (/^[a-z]/.test(tok)) {
      if (peek() !== "(") return { kind: "ref", key: tok };
      if (!(FORMULA_FNS as readonly string[]).includes(tok)) throw new FormulaError(`unknown function "${tok}"`);
      next(); // (
      const args = [expr()];
      while (peek() === ",") {
        next();
        args.push(expr());
      }
      if (next() !== ")") throw new FormulaError("missing )");
      if (tok === "trunc" && args.length > 2) throw new FormulaError("trunc takes (value) or (value, places)");
      return { kind: "call", fn: tok as FormulaFn, args };
    }
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
    case "call":
      return expr.args.flatMap(formulaRefs);
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
        if (Number.isNaN(l) || Number.isNaN(r)) return NaN; // JS gives NaN ** 0 === 1
        if (e.op === "^") return l ** r;
        return e.op === "+" ? l + r : e.op === "-" ? l - r : e.op === "*" ? l * r : l / r;
      }
      case "call": {
        const args = e.args.map(ev);
        if (e.fn === "trunc") {
          // Cut off (don't round) to N places, as some lab printouts do: trunc(1.0882, 2) → 1.08.
          // The epsilon stops float noise (0.29 * 100 = 28.999…) from losing a digit.
          const f = 10 ** (args[1] ?? 0);
          return Math.trunc(args[0] * f + Math.sign(args[0]) * 1e-9) / f;
        }
        return e.fn === "min" ? Math.min(...args) : Math.max(...args);
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
