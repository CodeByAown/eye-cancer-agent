"use client";

import { Bell, Search } from "lucide-react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { SystemStatus } from "@/components/layout/system-status";
import { UserAvatar } from "@/components/layout/user-avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="border-border/60 bg-background/70 sticky top-0 z-30 flex h-16 items-center gap-4 border-b px-6 backdrop-blur-xl">
      <MobileNav />

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground truncate text-xs">{subtitle}</p>}
      </div>

      <button
        type="button"
        className="text-muted-foreground hover:border-border hover:bg-muted/50 hidden items-center gap-2 rounded-md border border-transparent px-3 py-1.5 text-sm transition-colors md:flex"
      >
        <Search className="size-3.5" />
        <span>Search</span>
        <kbd className="bg-muted text-muted-foreground ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </button>

      <SystemStatus className="hidden lg:inline-flex" />

      <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
        <Bell className="size-4" />
        <span className="bg-accent absolute right-2 top-2 size-1.5 rounded-full" />
      </Button>

      <ThemeToggle />

      <UserAvatar />
    </header>
  );
}
