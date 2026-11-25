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
        "group relative flex h-9 items-center gap-3 rounded-[3px] px-2.5 text-[13px] transition-colors",
        active ? "bg-accent-soft font-medium text-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
        collapsed && "justify-center px-0",
      )}
    >
      {active && <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-accent" />}
      <Icon className={cn("size-[17px] shrink-0", active ? "text-accent-ink" : "text-faint group-hover:text-ink")} strokeWidth={1.6} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          <span className="num text-[10px] text-faint opacity-0 transition-opacity group-hover:opacity-100">{item.index}</span>
        </>
      )}
    </Link>
  );
}

function SidebarBody({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const profile = useStore((s) => s.data.settings.profile);
  const semester = useStore((s) => s.data.settings.semesters.find((x) => x.id === s.data.settings.currentSemesterId));
  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center border-b border-line px-4", collapsed && "justify-center px-0")}>
        <Link href="/" onClick={onNavigate} className="flex items-baseline gap-1.5" aria-label="UniOS home">
          <span className="font-serif text-[26px] leading-none tracking-tight text-ink">{collapsed ? "U" : "UniOS"}</span>
          {!collapsed && <span className="num text-[9px] uppercase tracking-[0.14em] text-faint">v0.1</span>}
        </Link>
      </div>
      <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {!collapsed && <div className="eyebrow px-2.5 pb-2 pt-1">Workspace</div>}
        {NAV.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
        <div className="my-3 border-t border-line" />
        {NAV_SECONDARY.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>
      {!collapsed && (
        <div className="border-t border-line p-4">
          <div className="text-[13px] font-medium text-ink">{profile.name || "Student"}</div>
          <div className="mt-0.5 truncate text-[11px] text-muted">{profile.program || profile.university || "Set up your profile in Settings"}</div>
          {semester && <div className="num mt-2 text-[10px] uppercase tracking-wider text-faint">{semester.name}</div>}
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
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 border-r border-line bg-bg transition-[width] duration-200 lg:block", collapsed ? "w-[64px]" : "w-[236px]")}>
        <SidebarBody collapsed={collapsed} />
        <button
          onClick={() => updateSettings({ sidebarCollapsed: !collapsed })}
          className="absolute -right-3 top-[68px] grid size-6 place-items-center rounded-full border border-line-strong bg-surface text-faint hover:text-ink"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-3" /> : <PanelLeftClose className="size-3" />}
        </button>
      </aside>
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-[#18242b]/35" onClick={() => setMobileNavOpen(false)} />
          <div className="fade-in absolute inset-y-0 left-0 w-[260px] border-r border-line bg-bg">
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
