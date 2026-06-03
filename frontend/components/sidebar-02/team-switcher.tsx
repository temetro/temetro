"use client";

import { Building2, ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

// Switches the active clinic (organization). Scopes every subsequent patient
// API call. Replaces the old static "team switcher".
export function OrgSwitcher() {
  const { isMobile, state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const router = useRouter();
  const { data: orgs } = authClient.useListOrganizations();
  const { data: activeOrg } = authClient.useActiveOrganization();

  const setActive = async (organizationId: string) => {
    if (organizationId === activeOrg?.id) return;
    await authClient.organization.setActive({ organizationId });
  };

  const activeName = activeOrg?.name ?? "Select clinic";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Menu>
          <MenuTrigger
            render={
              <SidebarMenuButton
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                size="lg"
                tooltip={activeName}
              />
            }
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-background text-foreground">
              <Building2 className="size-4" />
            </div>
            {!isCollapsed && (
              <>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{activeName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Clinic
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </>
            )}
          </MenuTrigger>
          <MenuPopup
            align="start"
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : isCollapsed ? "right" : "bottom"}
            sideOffset={4}
          >
            <MenuGroup>
              <MenuGroupLabel className="text-xs text-muted-foreground">
                Clinics
              </MenuGroupLabel>
              {(orgs ?? []).map((org) => (
                <MenuItem
                  className="gap-2 p-2"
                  key={org.id}
                  onClick={() => setActive(org.id)}
                >
                  <div className="flex size-6 items-center justify-center rounded-sm border">
                    <Building2 className="size-4 shrink-0" />
                  </div>
                  <span className="truncate">{org.name}</span>
                </MenuItem>
              ))}
            </MenuGroup>
            <MenuSeparator />
            <MenuItem
              className="gap-2 p-2"
              onClick={() => router.push("/onboarding")}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">
                Create clinic
              </div>
            </MenuItem>
          </MenuPopup>
        </Menu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
