import { cn } from "@/lib/utils";

/** Red asterisk after a field label ("Delivery date *"). Mark the input itself with `required`. */
export function RequiredMark() {
  return (
    <span aria-hidden className="ml-0.5 text-danger-strong">
      *
    </span>
  );
}

/**
 * Form select as drawn in the references: a 42 px field with a ▾ glyph at the right edge (supplier, currency,
 * office, role). Native <select>, so it is keyboard- and screen-reader-friendly and renders before hydration.
 * size="sm": 14 px text with 12 px left padding and a smaller ▼, as in the form references (15, 21, 23, 25, 27,
 * 29, 48, 51, 53), matching `Input size="sm"`.
 */
export function NativeSelect({
  className,
  children,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & { size?: "default" | "sm" }) {
  const sm = size === "sm";
  return (
    <div className={cn("relative w-full", className)}>
      <select
        className={cn(
          "h-[42px] w-full appearance-none rounded-lg border border-input bg-input-background pr-9 text-foreground outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/25 disabled:opacity-50 aria-invalid:border-destructive",
          sm ? "pl-3 text-sm" : "pl-3.5 text-[15px]",
        )}
        {...props}
      >
        {children}
      </select>
      <span
        aria-hidden
        className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-foreground", sm ? "right-[13px] text-[10px]" : "right-3.5 text-xs")}
      >
        ▼
      </span>
    </div>
  );
}

/** Right-aligned form actions: outline "Save draft" plus the primary action (Button size="lg"). */
export function FormFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-wrap justify-end gap-4", className)} {...props} />;
}
