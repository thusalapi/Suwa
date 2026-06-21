import { Badge } from "suwa";

export const Draft = () => <Badge>Draft</Badge>;
export const Verified = () => <Badge tone="success">Verified</Badge>;
export const Cancelled = () => <Badge tone="danger">Cancelled</Badge>;

export const StatusRow = () => (
  <span style={{ display: "inline-flex", gap: 8 }}>
    <Badge>Draft</Badge>
    <Badge tone="success">Paid</Badge>
    <Badge tone="danger">Overdue</Badge>
  </span>
);
