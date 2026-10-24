import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** Labelled read-only input as on the receiving (09) and containers (10) tabs: 12.5 px bold label, 4 px gap. */
export function ReadOnlyField({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <Field className="gap-1">
      <FieldLabel htmlFor={id} className="text-[12.5px] leading-[18px] font-bold text-label">
        {label}
      </FieldLabel>
      <Input id={id} value={value} readOnly />
    </Field>
  );
}
