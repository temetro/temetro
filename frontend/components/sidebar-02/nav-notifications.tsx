"use client";

import { BellIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { useNotifications } from "@/lib/use-notifications";

// ISO timestamp -> "just now" / "10m ago" / "3h ago" / "2d ago".
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationsPopover() {
  const { t } = useTranslation();
  const { items, unread, markAllRead } = useNotifications();

  return (
    <Menu
      onOpenChange={(open) => {
        // Viewing the list clears the unread badge.
        if (open && unread > 0) markAllRead();
      }}
    >
      <MenuTrigger
        render={
          <Button
            aria-label={t("nav.notifications")}
            className="relative rounded-full"
            size="icon"
            variant="ghost"
          />
        }
      >
        <BellIcon className="size-5" />
        {unread > 0 && (
          <span className="-top-0.5 -right-0.5 absolute flex min-w-4 items-center justify-center rounded-full bg-primary px-1 font-medium text-[10px] text-primary-foreground leading-4">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </MenuTrigger>
      <MenuPopup side="right" className="my-6 w-80">
        <MenuGroup>
          <MenuGroupLabel>{t("nav.notifications")}</MenuGroupLabel>
        </MenuGroup>
        <MenuSeparator />
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-muted-foreground text-sm">
            {t("nav.notificationsEmpty")}
          </div>
        ) : (
          items.map((n) => (
            <MenuItem className="flex items-start gap-3" key={n.id}>
              <Avatar className="size-8">
                <AvatarFallback>{n.actorInitials ?? "•"}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-sm">{n.text}</span>
                <span className="text-muted-foreground text-xs">
                  {relativeTime(n.createdAt)}
                </span>
              </div>
            </MenuItem>
          ))
        )}
      </MenuPopup>
    </Menu>
  );
}
