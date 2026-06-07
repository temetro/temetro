import { toastManager } from "@/components/ui/toast";

// Thin wrapper over COSS's (Base UI) toast manager so callers don't repeat the
// `{ type, title, description }` shape. COSS ships its own Sonner-style stacked
// toast — this is the app-wide notification entry point. The matching
// <ToastProvider> lives in app/layout.tsx.
export const notify = {
  success: (title: string, description?: string) =>
    toastManager.add({ type: "success", title, description }),
  error: (title: string, description?: string) =>
    toastManager.add({ type: "error", title, description }),
  info: (title: string, description?: string) =>
    toastManager.add({ type: "info", title, description }),
  warning: (title: string, description?: string) =>
    toastManager.add({ type: "warning", title, description }),
};
