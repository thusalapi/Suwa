import { Spinner, Button } from "suwa";

export const Inline = () => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--ds-ink)" }}>
    <Spinner label="Loading" />
    <span>Loading reports…</span>
  </span>
);

export const InButton = () => (
  <Button disabled>
    <Spinner label="Saving" /> Saving…
  </Button>
);
