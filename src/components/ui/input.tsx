import * as React from "react"
import { cn } from "cn"

// Restyled to the references: 42 px fields, 8 px radius. Read-only fields use the grey fill (orders › receiving);
// pass className="border-dashed" for empty optional fields such as "Select date" (clearing, transport).
// size="sm": 14 px text with 12 px side padding, as in the form references (15, 21, 23, 25, 27, 29, 48, 51, 53).
function Input({
  className,
  type,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & { size?: "default" | "sm" }) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-[42px] w-full min-w-0 rounded-lg border border-input bg-input-background text-foreground transition-colors outline-none placeholder:text-placeholder read-only:bg-input-readonly focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 file:border-0 file:bg-transparent file:text-sm file:font-bold",
        size === "sm" ? "px-3 text-sm" : "px-3.5 text-[15px]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
