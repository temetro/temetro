import {
  BarChart3,
  CalendarClock,
  History,
  ListTodo,
  type LucideIcon,
  Mail,
  NotebookPen,
  Pill,
  Plus,
  Settings,
  Users,
} from "lucide-react";

export type NavSubItem = {
  id: string;
  // i18n key resolved with t() at render time.
  labelKey: string;
  icon?: LucideIcon;
  link: string;
  // Hidden from non-clinical roles (e.g. reception). See lib/roles.ts.
  requiresClinical?: boolean;
};

export type NavItem = {
  id: string;
  // i18n key resolved with t() at render time.
  labelKey: string;
  icon: LucideIcon;
  link: string;
  // Optional sub-pages revealed under this item in the sidebar.
  subs?: NavSubItem[];
  // Hidden from non-clinical roles (e.g. reception). See lib/roles.ts.
  requiresClinical?: boolean;
};

// Single source of truth for the primary navigation. Consumed by the sidebar
// (components/sidebar-02/app-sidebar.tsx) and the command palette
// (components/command-palette.tsx) so the two never drift.
export const navItems: NavItem[] = [
  {
    id: "new-chat",
    labelKey: "nav.newChat",
    icon: Plus,
    link: "/",
    requiresClinical: true,
  },
  {
    id: "patients",
    labelKey: "nav.patients",
    icon: Users,
    link: "/patients",
    subs: [
      { id: "patients-list", labelKey: "nav.patients", link: "/patients" },
      {
        id: "appointments",
        labelKey: "nav.appointments",
        icon: CalendarClock,
        link: "/appointments",
      },
      {
        id: "prescriptions",
        labelKey: "nav.prescriptions",
        icon: Pill,
        link: "/prescriptions",
        requiresClinical: true,
      },
    ],
  },
  {
    id: "analysis",
    labelKey: "nav.analysis",
    icon: BarChart3,
    link: "/analysis",
    requiresClinical: true,
  },
  { id: "messages", labelKey: "nav.messages", icon: Mail, link: "/messages" },
  {
    id: "notes",
    labelKey: "nav.notes",
    icon: NotebookPen,
    link: "/notes",
    requiresClinical: true,
  },
  { id: "tasks", labelKey: "nav.tasks", icon: ListTodo, link: "/tasks" },
  {
    id: "activity",
    labelKey: "nav.activity",
    icon: History,
    link: "/activity",
    requiresClinical: true,
  },
  { id: "settings", labelKey: "nav.settings", icon: Settings, link: "/settings" },
];
