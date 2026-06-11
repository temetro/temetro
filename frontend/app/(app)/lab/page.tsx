import { LabView } from "@/components/lab/lab-view";
import { SidebarInset } from "@/components/ui/sidebar";

export default function LabPage() {
  return (
    <SidebarInset className="flex flex-1 flex-col overflow-y-auto">
      <LabView />
    </SidebarInset>
  );
}
