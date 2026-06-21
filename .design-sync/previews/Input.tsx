import { Input } from "suwa";

export const Default = () => (
  <Input placeholder="Search patients by phone" defaultValue="" />
);
export const Filled = () => <Input defaultValue="+94 77 123 4567" />;
export const Invalid = () => <Input invalid defaultValue="077-bad" />;
export const Disabled = () => <Input disabled placeholder="Read only" />;
