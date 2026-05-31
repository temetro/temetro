import { SidebarInset } from "@/components/ui/sidebar";
import { SettingsView } from "@/components/settings/settings-view";

export default function SettingsPage() {
  return (
    <SidebarInset className="flex flex-1 flex-col overflow-y-auto">
      <SettingsView />
    </SidebarInset>
  );
}
