import { PrescriptionsView } from "@/components/prescriptions/prescriptions-view";
import { SidebarInset } from "@/components/ui/sidebar";

export default function PrescriptionsPage() {
  return (
    <SidebarInset className="flex flex-1 flex-col overflow-y-auto">
      <PrescriptionsView />
    </SidebarInset>
  );
}
