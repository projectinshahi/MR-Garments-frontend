"use client";

import { FilterSelect, type FilterOption } from "@/components/shared/filters";
import { notInPrototype } from "@/components/shared/prototype";
import { Button } from "@/components/ui/button";

/** A button from the reference whose action has no design (D5): exports. */
export function PrototypeButton({ action, ...props }: React.ComponentProps<typeof Button> & { action: string }) {
  return <Button type="button" onClick={() => notInPrototype(action)} {...props} />;
}

/** Header actions on every report (33–38). */
export function ExportActions() {
  return (
    <>
      <PrototypeButton action="Export Excel" variant="outline">
        Export Excel
      </PrototypeButton>
      <PrototypeButton action="Export PDF" variant="outline">
        Export PDF
      </PrototypeButton>
    </>
  );
}

const ALL_SUPPLIERS = "all";

/**
 * Hub header filters (32): the period lists only the designed period; choosing a supplier is not designed (D5),
 * so the selection stays on "All suppliers".
 */
export function HubFilters({ periods, suppliers }: { periods: FilterOption[]; suppliers: string[] }) {
  const supplierOptions = [{ value: ALL_SUPPLIERS, label: "All suppliers" }, ...suppliers.map((name) => ({ value: name, label: name }))];
  return (
    <>
      <FilterSelect
        size="sm"
        showLabel
        label="Period"
        value={periods[0].value}
        options={periods}
        onValueChange={() => undefined}
        className="h-[37px]"
      />
      <FilterSelect
        size="sm"
        label="Supplier"
        value={ALL_SUPPLIERS}
        options={supplierOptions}
        onValueChange={(value) => {
          if (value !== ALL_SUPPLIERS) notInPrototype("Filter by supplier");
        }}
        className="h-[37px]"
      />
    </>
  );
}
