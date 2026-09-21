"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, Users, UserRound, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
const links = [
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/networks", label: "Networks", icon: Users },
  { href: "/connections", label: "Conexões", icon: Handshake },
  { href: "/profile", label: "Meu perfil", icon: UserRound },
];
export function MemberNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Navegação da comunidade"
      className="flex gap-1 overflow-x-auto py-2 md:gap-2"
    >
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          href={href}
          key={href}
          aria-current={path.startsWith(href) ? "page" : undefined}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition-colors sm:px-4",
            path.startsWith(href)
              ? "bg-primary text-white"
              : "text-muted-foreground hover:bg-secondary",
          )}
        >
          <Icon size={15} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
