import { MessagesView } from "@/components/messages/messages-view";
import { SidebarInset } from "@/components/ui/sidebar";

export default function MessagesPage() {
  return (
    <SidebarInset className="flex flex-1 flex-col overflow-hidden">
      <MessagesView />
    </SidebarInset>
  );
}
