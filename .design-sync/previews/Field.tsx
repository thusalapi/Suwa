import { Field, Input } from "suwa";

export const WithHint = () => (
  <Field label="Phone number" htmlFor="phone" hint="Used to find the patient">
    <Input id="phone" defaultValue="+94 77 123 4567" />
  </Field>
);

export const WithError = () => (
  <Field label="Phone number" htmlFor="phone2" error="Phone number is required">
    <Input id="phone2" invalid defaultValue="" />
  </Field>
);

export const Optional = () => (
  <Field label="NIC (optional)" htmlFor="nic">
    <Input id="nic" placeholder="200012345678" />
  </Field>
);
