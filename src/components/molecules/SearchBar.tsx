import { Input } from "@/components/atoms/Input";
import { Button } from "@/components/atoms/Button";

export interface SearchBarProps {
  /** URL the GET form submits to (e.g. "/patients"). */
  action: string;
  /** Query-param name. Defaults to "q". */
  name?: string;
  defaultValue?: string;
  placeholder: string;
  /** Accessible label (visually hidden). */
  label: string;
  submitLabel: string;
}

/**
 * Server-rendered search box: a GET form, so search works without client JS and is shareable
 * via the URL. Copy comes in as props (resolved by the caller via t()).
 */
export function SearchBar({ action, name = "q", defaultValue, placeholder, label, submitLabel }: SearchBarProps) {
  return (
    <form action={action} method="get" className="flex gap-2" role="search">
      <label htmlFor="search" className="sr-only">
        {label}
      </label>
      <Input
        id="search"
        name={name}
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="max-w-sm"
      />
      <Button type="submit" variant="secondary">
        {submitLabel}
      </Button>
    </form>
  );
}
