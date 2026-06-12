import { InventoryView } from "@/components/pharmacy/inventory-view";
import { SidebarInset } from "@/components/ui/sidebar";

export default function InventoryPage() {
  return (
    <SidebarInset className="flex flex-1 flex-col overflow-y-auto">
      <InventoryView />
    </SidebarInset>
  );
}
