import { AppAuthGuard } from "@/components/auth/app-auth-guard";
import { CommandPaletteProvider } from "@/components/command-palette";
import { DashboardSidebar } from "@/components/sidebar-02/app-sidebar";
import { MobileSidebarTrigger } from "@/components/sidebar-02/mobile-sidebar-trigger";
import { SidebarProvider } from "@/components/ui/sidebar";
import { UpdateBanner } from "@/components/update-banner";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppAuthGuard>
      <CommandPaletteProvider>
        <SidebarProvider>
          <div className="relative flex h-dvh w-full">
            <DashboardSidebar />
            <MobileSidebarTrigger />
            {children}
            <UpdateBanner />
          </div>
        </SidebarProvider>
      </CommandPaletteProvider>
    </AppAuthGuard>
  );
}
