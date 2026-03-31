"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpenText,
  ChevronRight,
  LayoutDashboard,
  Menu,
  PhoneCall,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/call-console", label: "Call Console", icon: PhoneCall },
  { href: "/knowledge-base", label: "Knowledge Base", icon: BookOpenText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-2">
      {navigation.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-all",
              active
                ? "border-white/10 bg-white/12 text-white shadow-lg shadow-black/10"
                : "border-transparent bg-white/4 text-white/72 hover:border-white/10 hover:bg-white/8 hover:text-white",
            )}
          >
            <span className="flex items-center gap-3">
              <Icon className="h-4 w-4" />
              {item.label}
            </span>
            <ChevronRight className={cn("h-4 w-4 opacity-0 transition", active && "opacity-100")} />
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent() {
  return (
    <div className="flex h-full flex-col gap-8 rounded-[28px] border border-white/10 bg-sidebar px-5 py-6 text-sidebar-foreground shadow-2xl shadow-cyan-950/20">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/70">
          Call Bank
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-white">
            Voice AI Suite
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/65">
            Live call ops, outbound orchestration, and retrieval-backed prompt control.
          </p>
        </div>
      </div>
      <SidebarNav />
      <div className="mt-auto rounded-3xl border border-white/10 bg-white/6 p-4 text-sm text-white/75">
        <p className="font-semibold text-white">Ops note</p>
        <p className="mt-2 leading-6">
          The dashboard syncs provider data through the backend and keeps analytics available across restarts.
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-4 lg:px-5 lg:py-5">
      <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <SidebarContent />
        </aside>
        <div className="rounded-[32px] border border-white/70 glass-card shadow-2xl shadow-amber-100/50">
          <header className="flex items-center justify-between border-b border-border/60 px-5 py-4 lg:px-8">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Enterprise Integration
              </div>
              <div className="mt-1 font-heading text-xl font-semibold tracking-tight text-foreground">
                Voice AI Dashboard & Integration Suite
              </div>
            </div>
            <Sheet>
              <SheetTrigger
                render={<Button variant="outline" size="icon" className="lg:hidden" />}
              >
                <Menu className="h-4 w-4" />
              </SheetTrigger>
              <SheetContent side="left" className="border-0 bg-transparent p-3 shadow-none">
                <SidebarContent />
              </SheetContent>
            </Sheet>
          </header>
          <main className="px-5 py-5 lg:px-8 lg:py-7">{children}</main>
        </div>
      </div>
    </div>
  );
}
