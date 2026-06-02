export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No app chrome (sidebar) on auth screens — just a scrollable centered area.
  return <main className="flex-1 overflow-y-auto">{children}</main>;
}
