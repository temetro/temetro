"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/nav";
import { motion } from "framer-motion";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import type { Route } from "./nav-main";
import { SidebarCommandButton } from "@/components/command-palette";
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

  const dashboardRoutes: Route[] = navItems.map((item) => ({
    id: item.id,
    title: t(item.labelKey),
    icon: <item.icon className="size-4" />,
    link: item.link,
    subs: item.subs?.map((sub) => ({
      title: t(sub.labelKey),
      link: sub.link,
      icon: sub.icon ? <sub.icon className="size-4" /> : undefined,
    })),
  }));

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
        <Tooltip>
          <TooltipTrigger
            render={
              <a
                aria-label="temetro"
                className="flex items-center justify-center"
                href="#"
              >
                <Image
                  alt="temetro"
                  className="size-9 shrink-0"
                  height={36}
                  priority
                  src="/temetro-logo.png"
                  width={36}
                />
              </a>
            }
          />
          <TooltipPopup side="right">temetro</TooltipPopup>
        </Tooltip>

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
        <DashboardNavigation routes={dashboardRoutes} />
      </SidebarContent>
      <SidebarFooter className="p-2">
        <div
          className={cn(
            "flex flex-col gap-1 rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-1",
            isCollapsed && "border-0 bg-transparent p-0"
          )}
        >
          <SidebarCommandButton />
          <SidebarSeparator
            className={cn("mx-0 my-0.5", isCollapsed && "hidden")}
          />
          <OrgSwitcher />
          <SidebarSeparator
            className={cn("mx-0 my-0.5", isCollapsed && "hidden")}
          />
          <NavUser />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
