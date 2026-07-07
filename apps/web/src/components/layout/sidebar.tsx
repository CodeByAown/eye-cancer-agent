"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/site/logo";
import { complianceBadge, disclaimer, navSections } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** Inner sidebar content — shared by the desktop aside and the mobile drawer. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" aria-label="Home" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="text-muted-foreground/70 px-3 pb-2 text-[11px] font-medium uppercase tracking-wider">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.soon ? "#" : item.href}
                      aria-disabled={item.soon}
                      onClick={item.soon ? undefined : onNavigate}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                        item.soon && "cursor-default opacity-55 hover:bg-transparent",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-active"
                          className="bg-primary/12 absolute inset-0 rounded-md"
                          transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        />
                      )}
                      {active && (
                        <span className="bg-primary absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full" />
                      )}
                      <item.icon className={cn("relative size-4", active && "text-primary")} />
                      <span className="relative flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="bg-primary/15 text-primary relative rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                          {item.badge}
                        </span>
                      )}
                      {item.soon && (
                        <span className="text-muted-foreground/60 relative text-[10px]">soon</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-border/60 border-t p-4">
        <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
          <complianceBadge.icon className="text-primary size-3.5 shrink-0" />
          <span>{complianceBadge.label}</span>
        </div>
        <p className="text-muted-foreground/70 mt-2 text-[10px] leading-relaxed">{disclaimer}</p>
      </div>
    </div>
  );
}

/** Desktop sidebar (fixed rail). */
export function Sidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "bg-surface/40 border-border/60 w-64 shrink-0 border-r backdrop-blur-xl",
        className,
      )}
    >
      <SidebarContent />
    </aside>
  );
}
