import { Button } from "suwa";

export const Primary = () => <Button>Save patient</Button>;
export const Secondary = () => <Button variant="secondary">Cancel</Button>;
export const Ghost = () => <Button variant="ghost">View history</Button>;
export const Danger = () => <Button variant="danger">Cancel bill</Button>;
export const Small = () => (
  <Button size="sm">Add item</Button>
);
export const Disabled = () => <Button disabled>Saving…</Button>;
