import { unitParts } from "@/lib/report-engine/display";

/** A measurement unit with its powers as real superscripts: "1.73 m2" → 1.73 m², "x10^3/uL" → x10³/uL. */
export function Unit({ unit }: { unit: string | undefined }) {
  if (!unit) return null;
  return <>{unitParts(unit).map((p, i) => (p.sup ? <sup key={i}>{p.text}</sup> : <span key={i}>{p.text}</span>))}</>;
}
