import {
  BarChart3,
  Boxes,
  CalendarClock,
  Cross,
  FlaskConical,
  History,
  ListTodo,
  type LucideIcon,
  Mail,
  NotebookPen,
  Pill,
  Plus,
  Receipt,
  Settings,
  Users,
  Video,
} from "lucide-react";

// Access areas gate routes/nav by role capability (probed against the Better
// Auth permissions in lib/access.ts — see canAccessArea in lib/roles.ts):
// - "clinical": full clinicians only (owner/admin/doctor/member).
// - "pharmacy": pharmacy + full clinicians.
// - "lab": lab + full clinicians.
// Defined here (not roles.ts) because roles.ts imports nav.ts.
export type AccessArea = "clinical" | "pharmacy" | "lab";

export type NavSubItem = {
  id: string;
  // i18n key resolved with t() at render time.
  labelKey: string;
  icon?: LucideIcon;
  link: string;
  // Hidden from roles outside this access area. See lib/roles.ts.
  access?: AccessArea;
};

export type NavItem = {
  id: string;
  // i18n key resolved with t() at render time.
  labelKey: string;
  icon: LucideIcon;
  link: string;
  // Optional sub-pages revealed under this item in the sidebar.
  subs?: NavSubItem[];
  // Hidden from roles outside this access area. See lib/roles.ts.
  access?: AccessArea;
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
    access: "clinical",
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
        id: "invoices",
        labelKey: "nav.invoices",
        icon: Receipt,
        link: "/invoices",
        access: "clinical",
      },
      {
        id: "prescriptions",
        labelKey: "nav.prescriptions",
        icon: Pill,
        link: "/prescriptions",
        access: "clinical",
      },
    ],
  },
  {
    id: "analysis",
    labelKey: "nav.analysis",
    icon: BarChart3,
    link: "/analysis",
    access: "clinical",
  },
  {
    id: "pharmacy",
    labelKey: "nav.pharmacy",
    icon: Cross,
    link: "/pharmacy",
    access: "pharmacy",
    subs: [
      {
        id: "pharmacy-dispensing",
        labelKey: "nav.pharmacy",
        link: "/pharmacy",
      },
      {
        id: "inventory",
        labelKey: "nav.inventory",
        icon: Boxes,
        link: "/inventory",
      },
    ],
  },
  {
    id: "lab",
    labelKey: "nav.lab",
    icon: FlaskConical,
    link: "/lab",
    access: "lab",
  },
  {
    id: "messages",
    labelKey: "nav.messages",
    icon: Mail,
    link: "/messages",
    subs: [
      { id: "messages-inbox", labelKey: "nav.inbox", link: "/messages" },
      {
        id: "meetings",
        labelKey: "nav.meetings",
        icon: Video,
        link: "/messages/meetings",
      },
    ],
  },
  {
    id: "notes",
    labelKey: "nav.notes",
    icon: NotebookPen,
    link: "/notes",
    access: "clinical",
  },
  { id: "tasks", labelKey: "nav.tasks", icon: ListTodo, link: "/tasks" },
  {
    id: "activity",
    labelKey: "nav.activity",
    icon: History,
    link: "/activity",
    access: "clinical",
  },
  { id: "settings", labelKey: "nav.settings", icon: Settings, link: "/settings" },
];
