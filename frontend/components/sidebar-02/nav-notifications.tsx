"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { BellIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

type Notification = {
  id: string;
  avatar: string;
  fallback: string;
  text: string;
  time: string;
};

export function NotificationsPopover({
  notifications,
}: {
  notifications: Notification[];
}) {
  const { t } = useTranslation();
  return (
    <Menu>
      <MenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Open notifications" />}><BellIcon className="size-5" /></MenuTrigger>
      <MenuPopup side="right" className="w-80 my-6">
        <MenuGroupLabel>{t("nav.notifications")}</MenuGroupLabel>
        <MenuSeparator />
        {notifications.map(({ id, avatar, fallback, text, time }) => (
          <MenuItem key={id} className="flex items-start gap-3">
            <Avatar className="size-8">
              <AvatarImage src={avatar} alt="Avatar" />
              <AvatarFallback>{fallback}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{text}</span>
              <span className="text-xs text-muted-foreground">{time}</span>
            </div>
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem className="justify-center text-sm text-muted-foreground hover:text-primary">
          {t("nav.viewAllNotifications")}
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
