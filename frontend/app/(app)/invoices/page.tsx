import { InvoicesView } from "@/components/invoices/invoices-view";
import { SidebarInset } from "@/components/ui/sidebar";

export default function InvoicesPage() {
  return (
    <SidebarInset className="flex flex-1 flex-col overflow-y-auto">
      <InvoicesView />
    </SidebarInset>
  );
}
