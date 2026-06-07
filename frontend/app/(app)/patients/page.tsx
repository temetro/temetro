import { SidebarInset } from "@/components/ui/sidebar";
import { PatientsView } from "@/components/patients/patients-view";

export default function PatientsPage() {
  return (
    <SidebarInset className="flex flex-1 flex-col overflow-y-auto">
      <PatientsView />
    </SidebarInset>
  );
}
