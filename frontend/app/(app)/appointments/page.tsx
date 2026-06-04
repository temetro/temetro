import { AppointmentsView } from "@/components/appointments/appointments-view";
import { SidebarInset } from "@/components/ui/sidebar";

export default function AppointmentsPage() {
  return (
    <SidebarInset className="flex flex-1 flex-col overflow-y-auto">
      <AppointmentsView />
    </SidebarInset>
  );
}
