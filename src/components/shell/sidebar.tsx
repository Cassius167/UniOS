"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { NAV, NAV_SECONDARY, isActive, type NavItem } from "./nav";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

function NavLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-full px-3.5 text-sm",
        active ? "bg-surface font-medium text-ink shadow-soft" : "text-muted hover:bg-surface/70 hover:text-ink",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className={cn("size-[17px] shrink-0", active ? "text-accent-ink" : "text-faint group-hover:text-ink")} strokeWidth={1.6} />
      {!collapsed && (
        <span className="flex-1 truncate">{item.label}</span>
      )}
    </Link>
  );
}

function SidebarBody({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const profile = useStore((s) => s.data.settings.profile);
  const semester = useStore((s) => s.data.settings.semesters.find((x) => x.id === s.data.settings.currentSemesterId));
  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-16 items-center px-6", collapsed && "justify-center px-0")}>
        <Link href="/" onClick={onNavigate} className="flex items-baseline gap-1.5" aria-label="UniOS home">
          <span className="font-serif text-[28px] leading-none text-ink">{collapsed ? "U" : "UniOS"}</span>
        </Link>
      </div>
      <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
        {NAV.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
        <div className="my-3 mx-3 border-t border-line/70" />
        {NAV_SECONDARY.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>
      {!collapsed && (
        <div className="m-3 flex items-center gap-3 rounded-2xl bg-surface/70 p-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft font-serif text-lg text-accent-ink">{(profile.name || "S").trim().charAt(0).toUpperCase()}</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-ink">{profile.name || "Student"}</div>
            <div className="truncate text-xs text-muted">{semester?.name || profile.program || "Set up your profile in Settings"}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const collapsed = useStore((s) => s.data.settings.sidebarCollapsed);
  const updateSettings = useStore((s) => s.updateSettings);
  const { mobileNavOpen, setMobileNavOpen } = useUI();
  return (
    <>
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 bg-surface-2/60 transition-[width] duration-300 ease-out lg:block", collapsed ? "w-[72px]" : "w-[248px]")}>
        <SidebarBody collapsed={collapsed} />
        <button
          onClick={() => updateSettings({ sidebarCollapsed: !collapsed })}
          className="absolute -right-3 top-[72px] grid size-6 place-items-center rounded-full border border-line bg-surface text-faint shadow-soft hover:text-ink"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-3" /> : <PanelLeftClose className="size-3" />}
        </button>
      </aside>
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="overlay-in absolute inset-0 bg-[#18242b]/25 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
          <div className="slide-in absolute inset-y-0 left-0 w-[272px] rounded-r-3xl bg-bg shadow-lift">
            <button className="absolute right-3 top-4 text-muted" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation">
              <X className="size-5" />
            </button>
            <SidebarBody collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
