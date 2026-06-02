import { AppAuthGuard } from "@/components/auth/app-auth-guard";
import { DashboardSidebar } from "@/components/sidebar-02/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppAuthGuard>
      <SidebarProvider>
        <div className="relative flex h-dvh w-full">
          <DashboardSidebar />
          {children}
        </div>
      </SidebarProvider>
    </AppAuthGuard>
  );
}
