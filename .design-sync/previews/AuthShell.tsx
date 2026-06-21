import { AuthShell, Field, Input, Button } from "suwa";

export const LoginForm = () => (
  <AuthShell>
    <h1 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600, color: "var(--ds-ink)" }}>
      Sign in
    </h1>
    <form style={{ display: "grid", gap: 16 }}>
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" placeholder="you@clinic.lk" />
      </Field>
      <Field label="Password" htmlFor="pw">
        <Input id="pw" type="password" placeholder="Your password" />
      </Field>
      <Button>Sign in</Button>
    </form>
  </AuthShell>
);
