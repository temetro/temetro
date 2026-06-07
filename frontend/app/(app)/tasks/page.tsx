import { TasksView } from "@/components/tasks/tasks-view";
import { SidebarInset } from "@/components/ui/sidebar";

export default function TasksPage() {
  return (
    <SidebarInset className="flex flex-1 flex-col overflow-hidden">
      <TasksView />
    </SidebarInset>
  );
}
