import {
  BarChart3,
  BookOpen,
  CalendarDays,
  LayoutGrid,
  ListChecks,
  NotebookPen,
  Percent,
  Settings,
  Sparkles,
  Timer,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  index: string;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutGrid, index: "01" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, index: "02" },
  { href: "/courses", label: "My Courses", icon: BookOpen, index: "03" },
  { href: "/assignments", label: "Assignments", icon: ListChecks, index: "04" },
  { href: "/grades", label: "Grade Tracker", icon: Percent, index: "05" },
  { href: "/focus", label: "Focus", icon: Timer, index: "06" },
  { href: "/notes", label: "Notes & Resources", icon: NotebookPen, index: "07" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, index: "08" },
];

export const NAV_SECONDARY: NavItem[] = [
  { href: "/assistant", label: "Study Assistant", icon: Sparkles, index: "09" },
  { href: "/settings", label: "Settings", icon: Settings, index: "10" },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
