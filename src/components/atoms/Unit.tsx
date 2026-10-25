import { nameParts, unitParts, type UnitPart } from "@/lib/report-engine/display";

function Parts({ parts }: { parts: UnitPart[] }) {
  return <>{parts.map((p, i) => (p.sup ? <sup key={i}>{p.text}</sup> : <span key={i}>{p.text}</span>))}</>;
}

/** A measurement unit with its powers as real superscripts: "1.73 m2" → 1.73 m², "x10^3/uL" → x10³/uL. */
export function Unit({ unit }: { unit: string | undefined }) {
  if (!unit) return null;
  return <Parts parts={unitParts(unit)} />;
}

/** A test name with explicit carets raised: "Serum Na^+" → Serum Na⁺. */
export function TestName({ name }: { name: string }) {
  return <Parts parts={nameParts(name)} />;
}
