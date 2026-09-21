import Link from "next/link";
import { cn } from "@/lib/utils";
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Sabença, início"
      className={cn(
        "inline-flex items-center gap-2.5 text-[27px] font-bold tracking-[-1.5px]",
        light && "text-white",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("brand-symbol", light && "brand-symbol-light")}
      >
        s<span>✳</span>
      </span>
      saben<span className="-ml-2.5">ça</span>
      <span className="mb-4 -ml-1 text-lg text-accent-foreground">.</span>
    </Link>
  );
}
