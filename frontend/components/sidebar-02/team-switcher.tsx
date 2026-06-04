"use client";

import { Building2, ChevronsUpDown, Info, Plus } from "lucide-react";
import { useState } from "react";

import { CreateClinicForm } from "@/components/clinic/create-clinic-form";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </div>
  );
}

// Switches the active clinic (organization). Scopes every subsequent patient
// API call. Lives in the sidebar footer; its menu also opens dialogs to view
// clinic info or create a new clinic.
export function OrgSwitcher() {
  const { isMobile, state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { data: orgs } = authClient.useListOrganizations();
  const { data: activeOrg } = authClient.useActiveOrganization();

  const [infoOpen, setInfoOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

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
                  <span className="truncate text-muted-foreground text-xs">
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
            side={isMobile ? "bottom" : isCollapsed ? "right" : "top"}
            sideOffset={4}
          >
            <MenuGroup>
              <MenuGroupLabel className="text-muted-foreground text-xs">
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
              disabled={!activeOrg}
              onClick={() => setInfoOpen(true)}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Info className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">
                Clinic info
              </div>
            </MenuItem>
            <MenuItem className="gap-2 p-2" onClick={() => setCreateOpen(true)}>
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

      {/* Read-only clinic details */}
      <Dialog onOpenChange={setInfoOpen} open={infoOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{activeOrg?.name ?? "Clinic"}</DialogTitle>
            <DialogDescription>Clinic information</DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-3 text-sm">
            <InfoRow label="Name" value={activeOrg?.name ?? "—"} />
            <InfoRow label="URL slug" value={activeOrg?.slug ?? "—"} />
            <InfoRow
              label="Clinics you belong to"
              value={String(orgs?.length ?? 0)}
            />
          </DialogPanel>
        </DialogPopup>
      </Dialog>

      {/* Create a new clinic (replaces the old /onboarding redirect) */}
      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create clinic</DialogTitle>
            <DialogDescription>
              Add a new clinic and switch to it.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <CreateClinicForm onCreated={() => setCreateOpen(false)} />
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </SidebarMenu>
  );
}
