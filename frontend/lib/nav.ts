import {
  BarChart3,
  type LucideIcon,
  Plus,
  Settings,
  Users,
} from "lucide-react";

export type NavItem = {
  id: string;
  // i18n key resolved with t() at render time.
  labelKey: string;
  icon: LucideIcon;
  link: string;
};

// Single source of truth for the primary navigation. Consumed by the sidebar
// (components/sidebar-02/app-sidebar.tsx) and the command palette
// (components/command-palette.tsx) so the two never drift.
export const navItems: NavItem[] = [
  { id: "new-chat", labelKey: "nav.newChat", icon: Plus, link: "/" },
  { id: "patients", labelKey: "nav.patients", icon: Users, link: "/patients" },
  {
    id: "analysis",
    labelKey: "nav.analysis",
    icon: BarChart3,
    link: "/analysis",
  },
  { id: "settings", labelKey: "nav.settings", icon: Settings, link: "/settings" },
];
