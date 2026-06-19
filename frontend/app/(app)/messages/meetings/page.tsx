import { MeetingsView } from "@/components/meetings/meetings-view";
import { SidebarInset } from "@/components/ui/sidebar";

export default function MeetingsPage() {
  return (
    <SidebarInset className="flex flex-1 flex-col overflow-hidden">
      <MeetingsView />
    </SidebarInset>
  );
}
