import * as React from "react"
import { cn } from "cn"

// Restyled to the references: 42 px fields, 8 px radius. Read-only fields use the grey fill (orders › receiving);
// pass className="border-dashed" for empty optional fields such as "Select date" (clearing, transport).
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-[42px] w-full min-w-0 rounded-lg border border-input bg-input-background px-3.5 text-[15px] text-foreground transition-colors outline-none placeholder:text-placeholder read-only:bg-input-readonly focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 file:border-0 file:bg-transparent file:text-sm file:font-bold",
        className
      )}
      {...props}
    />
  )
}

export { Input }
