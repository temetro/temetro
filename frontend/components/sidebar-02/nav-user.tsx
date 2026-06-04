"use client";

import {
  Building2,
  Check,
  ChevronsUpDown,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";

import { useCommandPalette } from "@/components/command-palette";
import { CreateClinicForm } from "@/components/clinic/create-clinic-form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { notify } from "@/lib/toast";

// Open-source repo (placeholder).
const REPO_URL = "https://github.com/temetro/temetro";

function initialsFromName(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2);
  return (letters || "?").toUpperCase();
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.21 11.16.6.11.82-.25.82-.55 0-.27-.01-1.16-.02-2.1-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.25 1.84 1.25 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.31-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.12-.31-.54-1.54.12-3.21 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.67.24 2.9.12 3.21.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.82 1.1.82 2.22 0 1.6-.02 2.89-.02 3.29 0 .31.21.69.83.57A12.02 12.02 0 0 0 24 12.29C24 5.78 18.63.5 12 .5Z" />
    </svg>
  );
}

// The sidebar's single footer row. Its menu also hosts the command-palette
// shortcut hint (below Theme) and a clinic switcher submenu (below that) whose
// popup reveals the active clinic's details on hover.
export function NavUser() {
  const { isMobile, state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { data } = authClient.useSession();
  const { open: openCommand } = useCommandPalette();
  const { data: orgs } = authClient.useListOrganizations();
  const { data: activeOrg } = authClient.useActiveOrganization();

  const [createOpen, setCreateOpen] = useState(false);

  const name = data?.user?.name ?? "Clinician";
  const email = data?.user?.email ?? "";
  const initials = initialsFromName(name);
  const activeName = activeOrg?.name ?? "Select clinic";

  const setActive = async (organizationId: string) => {
    if (organizationId === activeOrg?.id) return;
    await authClient.organization.setActive({ organizationId });
  };

  const signOut = async () => {
    const { error } = await authClient.signOut();
    if (error) {
      notify.error("Sign out failed", error.message ?? "Please try again.");
      return;
    }
    notify.success("Signed out");
    router.push("/login");
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Menu>
          <MenuTrigger
            render={
              <SidebarMenuButton
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                size="lg"
                tooltip={name}
              />
            }
          >
            <Avatar className="size-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-muted-foreground text-xs">
                    {email}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </>
            )}
          </MenuTrigger>
          <MenuPopup
            align="start"
            className="min-w-60"
            side={isMobile ? "bottom" : isCollapsed ? "right" : "top"}
            sideOffset={8}
          >
            <MenuGroup>
              <MenuGroupLabel className="flex items-center gap-2 py-2 text-foreground">
                <Avatar className="size-8">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-muted-foreground text-xs">
                    {email}
                  </span>
                </div>
              </MenuGroupLabel>
            </MenuGroup>
            <MenuSeparator />
            <MenuItem render={<Link href="/settings" />}>
              <SettingsIcon />
              Settings
            </MenuItem>
            <MenuItem
              render={<a href={REPO_URL} rel="noreferrer" target="_blank" />}
            >
              <GitHubIcon className="size-4" />
              Docs &amp; GitHub
            </MenuItem>
            <MenuItem
              closeOnClick={false}
              onClick={() => setTheme(isDark ? "light" : "dark")}
            >
              {isDark ? <Moon /> : <Sun />}
              Theme
              <MenuShortcut>{isDark ? "Dark" : "Light"}</MenuShortcut>
            </MenuItem>

            {/* Command palette: hint + shortcut, sits below Theme. */}
            <MenuItem onClick={openCommand}>
              <Search />
              Quick nav
              <KbdGroup className="ms-auto">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
            </MenuItem>

            {/* Clinic switcher: hover reveals the active clinic's details. */}
            <MenuSub>
              <MenuSubTrigger>
                <Building2 />
                <span className="truncate">{activeName}</span>
              </MenuSubTrigger>
              <MenuSubPopup className="min-w-64">
                <div className="px-2 py-1.5">
                  <p className="truncate font-medium text-foreground text-sm">
                    {activeOrg?.name ?? "No clinic selected"}
                  </p>
                  <p className="truncate text-muted-foreground text-xs">
                    {activeOrg?.slug ? `/${activeOrg.slug}` : "—"} ·{" "}
                    {orgs?.length ?? 0}{" "}
                    {orgs?.length === 1 ? "clinic" : "clinics"}
                  </p>
                </div>
                <MenuSeparator />
                <MenuGroup>
                  <MenuGroupLabel className="text-muted-foreground text-xs">
                    Switch clinic
                  </MenuGroupLabel>
                  {(orgs ?? []).map((org) => (
                    <MenuItem
                      className="gap-2"
                      key={org.id}
                      onClick={() => setActive(org.id)}
                    >
                      <div className="flex size-6 items-center justify-center rounded-sm border">
                        <Building2 className="size-4 shrink-0" />
                      </div>
                      <span className="flex-1 truncate">{org.name}</span>
                      {org.id === activeOrg?.id && <Check className="size-4" />}
                    </MenuItem>
                  ))}
                </MenuGroup>
                <MenuSeparator />
                <MenuItem className="gap-2" onClick={() => setCreateOpen(true)}>
                  <Plus />
                  Create clinic
                </MenuItem>
              </MenuSubPopup>
            </MenuSub>

            <MenuSeparator />
            <MenuItem onClick={signOut} variant="destructive">
              <LogOut />
              Log out
            </MenuItem>
          </MenuPopup>
        </Menu>
      </SidebarMenuItem>

      {/* Create a new clinic */}
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
