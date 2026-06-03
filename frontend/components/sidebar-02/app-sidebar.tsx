"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Plus, Settings, Users } from "lucide-react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import type { Route } from "./nav-main";
import DashboardNavigation from "@/components/sidebar-02/nav-main";
import { NotificationsPopover } from "@/components/sidebar-02/nav-notifications";
import { NavUser } from "@/components/sidebar-02/nav-user";
import { OrgSwitcher } from "@/components/sidebar-02/team-switcher";

const sampleNotifications = [
  {
    id: "1",
    avatar: "/avatars/01.png",
    fallback: "LR",
    text: "New lab results are available.",
    time: "10m ago",
  },
  {
    id: "2",
    avatar: "/avatars/02.png",
    fallback: "PC",
    text: "A patient chart was updated.",
    time: "1h ago",
  },
  {
    id: "3",
    avatar: "/avatars/03.png",
    fallback: "CT",
    text: "New message from the care team.",
    time: "2h ago",
  },
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const { t } = useTranslation();
  const isCollapsed = state === "collapsed";

  const dashboardRoutes: Route[] = [
    {
      id: "new-chat",
      title: t("nav.newChat"),
      icon: <Plus className="size-4" />,
      link: "/",
    },
    {
      id: "patients",
      title: t("nav.patients"),
      icon: <Users className="size-4" />,
      link: "/patients",
    },
    {
      id: "settings",
      title: t("nav.settings"),
      icon: <Settings className="size-4" />,
      link: "/settings",
    },
  ];

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader
        className={cn(
          "flex md:pt-3.5",
          isCollapsed
            ? "flex-row items-center justify-between gap-y-4 md:flex-col md:items-start md:justify-start"
            : "flex-row items-center justify-between"
        )}
      >
        <a href="#" className="flex items-center gap-2">
          <Image
            src="/temetro-logo.png"
            alt="temetro"
            width={32}
            height={32}
            className="size-8 shrink-0"
            priority
          />
          {!isCollapsed && (
            <span className="font-semibold text-black dark:text-white">
              temetro
            </span>
          )}
        </a>

        <motion.div
          key={isCollapsed ? "header-collapsed" : "header-expanded"}
          className={cn(
            "flex items-center gap-2",
            isCollapsed ? "flex-row md:flex-col-reverse" : "flex-row"
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <NotificationsPopover notifications={sampleNotifications} />
          <SidebarTrigger />
        </motion.div>
      </SidebarHeader>
      <SidebarContent className="gap-4 px-2 py-4">
        <OrgSwitcher />
        <DashboardNavigation routes={dashboardRoutes} />
      </SidebarContent>
      <SidebarFooter className="px-2">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
