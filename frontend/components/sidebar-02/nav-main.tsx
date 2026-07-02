"use client";

import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { useState } from "react";

export type Route = {
  id: string;
  title: string;
  icon?: React.ReactNode;
  link: string;
  subs?: {
    title: string;
    link: string;
    icon?: React.ReactNode;
  }[];
};

// True when `link` matches the current path. "/" only matches exactly; any other
// link matches itself and its nested routes (so a parent stays lit on subpages).
// Pass `exact` for sub-items so a parent link (e.g. /messages) doesn't also light
// the Inbox sub when a sibling sub (/messages/meetings) is the active page.
function useIsActive() {
  const pathname = usePathname();
  return (link: string, exact = false) => {
    if (link === "/" || exact) return pathname === link;
    return pathname === link || pathname.startsWith(`${link}/`);
  };
}

export default function DashboardNavigation({ routes }: { routes: Route[] }) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isActive = useIsActive();
  // Manual expand/collapse override per parent; falls back to "open when active".
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  return (
    <SidebarMenu>
      {routes.map((route) => {
        const hasSubs = !!route.subs?.length;
        const sectionActive =
          isActive(route.link) || !!route.subs?.some((s) => isActive(s.link));
        const isOpen = !isCollapsed && (overrides[route.id] ?? sectionActive);

        return (
          <SidebarMenuItem key={route.id}>
            <SidebarMenuButton
              className="text-muted-foreground"
              isActive={sectionActive}
              render={<Link href={route.link} prefetch={true} />}
              tooltip={route.title}
            >
              {route.icon}
              {!isCollapsed && (
                <span className="ms-2 flex-1 truncate font-medium text-sm">
                  {route.title}
                </span>
              )}
            </SidebarMenuButton>

            {hasSubs && !isCollapsed && (
              <SidebarMenuAction
                aria-label={isOpen ? "Collapse" : "Expand"}
                onClick={() =>
                  setOverrides((prev) => ({ ...prev, [route.id]: !isOpen }))
                }
              >
                <ChevronDown
                  className={cn(
                    "transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </SidebarMenuAction>
            )}

            {hasSubs && isOpen && (
              <SidebarMenuSub>
                {route.subs?.map((subRoute) => (
                  <SidebarMenuSubItem key={`${route.id}-${subRoute.link}`}>
                    <SidebarMenuSubButton
                      className="text-muted-foreground hover:bg-transparent hover:text-foreground active:bg-transparent data-[active=true]:bg-transparent data-[active=true]:font-medium data-[active=true]:text-foreground"
                      isActive={isActive(subRoute.link, true)}
                      render={<Link href={subRoute.link} prefetch={true} />}
                    >
                      <span className="truncate">{subRoute.title}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            )}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
