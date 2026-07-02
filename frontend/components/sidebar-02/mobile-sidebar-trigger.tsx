"use client";

import { PanelLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

// A floating top-right button that opens the sidebar on phones. The in-sidebar
// SidebarTrigger is unreachable on mobile once the offcanvas sidebar is closed,
// so this gives a persistent way to bring it back. Hidden on md+ where the
// sidebar is always docked.
export function MobileSidebarTrigger() {
  const { t } = useTranslation();
  const { toggleSidebar, openMobile } = useSidebar();

  // While the offcanvas Sheet is open it already covers the screen — no need to
  // float a button over it.
  if (openMobile) return null;

  return (
    <Button
      aria-label={t("nav.openSidebar")}
      className="fixed top-3 end-3 z-50 size-9 rounded-full bg-background/80 shadow-sm backdrop-blur md:hidden"
      onClick={toggleSidebar}
      size="icon"
      variant="outline"
    >
      <PanelLeft className="size-4" />
    </Button>
  );
}
