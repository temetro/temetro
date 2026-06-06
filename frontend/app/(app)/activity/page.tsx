import { ActivityView } from "@/components/activity/activity-view";
import { SidebarInset } from "@/components/ui/sidebar";

export default function ActivityPage() {
  return (
    <SidebarInset className="flex flex-1 flex-col overflow-y-auto">
      <ActivityView />
    </SidebarInset>
  );
}
