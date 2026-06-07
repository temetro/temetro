import { AnalysisView } from "@/components/analysis/analysis-view";
import { SidebarInset } from "@/components/ui/sidebar";

export default function AnalysisPage() {
  return (
    <SidebarInset className="flex flex-1 flex-col overflow-y-auto">
      <AnalysisView />
    </SidebarInset>
  );
}
