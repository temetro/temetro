"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAiAccess } from "@/lib/ai-policy";
import { useActiveRole, visibleNavItems } from "@/lib/roles";
import { motion } from "framer-motion";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import type { Route } from "./nav-main";
import DashboardNavigation from "@/components/sidebar-02/nav-main";
import { NotificationsPopover } from "@/components/sidebar-02/nav-notifications";
import { NavUser } from "@/components/sidebar-02/nav-user";
import { useCallInvites } from "@/components/meetings/use-call-invites";

export function DashboardSidebar() {
  const { state } = useSidebar();
  const { t } = useTranslation();
  const role = useActiveRole();
  const { allowed: aiAllowed } = useAiAccess();
  const isCollapsed = state === "collapsed";
  // Ring staff into calls from anywhere in the app.
  useCallInvites();

  // Hide clinical nav from non-clinical roles (e.g. reception). See lib/roles.ts.
  // Also drop the AI surfaces ("New chat" + "Analysis") when the clinic's AI
  // kill-switch applies — a full disable hides them for owners/admins too.
  const dashboardRoutes: Route[] = visibleNavItems(role)
    .filter(
      (item) => aiAllowed || (item.id !== "new-chat" && item.id !== "analysis"),
    )
    .map((item) => ({
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
                {/* White fox mark — inverted to black in light mode. */}
                <Image
                  alt="temetro"
                  className="size-10 shrink-0 invert dark:invert-0"
                  height={40}
                  priority
                  src="/temetro-logo.png"
                  width={40}
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
          <NotificationsPopover />
          <SidebarTrigger />
        </motion.div>
      </SidebarHeader>
      <SidebarContent className="gap-4 px-2 py-4">
        <DashboardNavigation routes={dashboardRoutes} />
      </SidebarContent>
      <SidebarFooter className="p-2">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
