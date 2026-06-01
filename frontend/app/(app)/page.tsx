import { Suspense } from "react";

import { SidebarInset } from "@/components/ui/sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";

export default function Home() {
  return (
    <SidebarInset className="flex flex-1 flex-col overflow-hidden">
      {/* ChatPanel reads the `?patient=` search param, so it needs a Suspense boundary. */}
      <Suspense>
        <ChatPanel />
      </Suspense>
    </SidebarInset>
  );
}
