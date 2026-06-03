"use client";

import { ChevronsUpDown, LogOut, Settings as SettingsIcon, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Menu,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

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

export function NavUser() {
  const { isMobile, state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const router = useRouter();
  const { data } = authClient.useSession();

  const name = data?.user?.name ?? "Clinician";
  const email = data?.user?.email ?? "";
  const initials = initialsFromName(name);

  const signOut = async () => {
    await authClient.signOut();
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
                  <span className="truncate text-xs text-muted-foreground">
                    {email}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </>
            )}
          </MenuTrigger>
          <MenuPopup
            align="start"
            className="min-w-56"
            side={isMobile ? "bottom" : isCollapsed ? "right" : "top"}
            sideOffset={8}
          >
            <MenuGroupLabel className="flex items-center gap-2 py-2 text-foreground">
              <Avatar className="size-8">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {email}
                </span>
              </div>
            </MenuGroupLabel>
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
            <MenuItem>
              <Sun />
              Theme
              <MenuShortcut>Dark</MenuShortcut>
            </MenuItem>
            <MenuSeparator />
            <MenuItem onClick={signOut} variant="destructive">
              <LogOut />
              Log out
            </MenuItem>
          </MenuPopup>
        </Menu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
