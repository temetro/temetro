import { NotesView } from "@/components/notes/notes-view";
import { SidebarInset } from "@/components/ui/sidebar";

export default function NotesPage() {
  return (
    <SidebarInset className="flex flex-1 flex-col overflow-hidden">
      <NotesView />
    </SidebarInset>
  );
}
