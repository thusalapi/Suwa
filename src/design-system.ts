/**
 * Design-system barrel — the public component surface. Doubles as:
 *  - the entry the design-sync converter bundles for Claude Design, and
 *  - the future extraction point for a shared `packages/ui` at SaaS scale.
 * Keep this free of app/data dependencies.
 */
export { Button } from "@/components/atoms/Button";
export { Input } from "@/components/atoms/Input";
export { Label } from "@/components/atoms/Label";
export { Field } from "@/components/atoms/Field";
export { Badge } from "@/components/atoms/Badge";
export { Spinner } from "@/components/atoms/Spinner";
export { Wordmark } from "@/components/atoms/Wordmark";
export { AuthShell } from "@/components/templates/AuthShell";
