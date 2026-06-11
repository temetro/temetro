import { PharmacyView } from "@/components/pharmacy/pharmacy-view";
import { SidebarInset } from "@/components/ui/sidebar";

export default function PharmacyPage() {
  return (
    <SidebarInset className="flex flex-1 flex-col overflow-y-auto">
      <PharmacyView />
    </SidebarInset>
  );
}
