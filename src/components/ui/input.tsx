import * as React from "react";
import { cn } from "@/lib/utils";
export function Input({
  className,
  type,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "flex h-12 w-full rounded-xl border border-border bg-background px-4 text-sm transition-shadow outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 disabled:opacity-50 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
