// The Patient Portal kiosk runs with no app chrome — no sidebar, no auth guard.
// It's a standalone full-screen surface for a clinic iPad / self-service device.
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="min-h-dvh w-full overflow-y-auto bg-background">{children}</main>;
}
