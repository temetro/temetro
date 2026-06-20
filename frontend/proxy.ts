import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Better Auth session cookie names (plain in dev, __Secure- prefixed over
// HTTPS). The authoritative check happens client-side (AppAuthGuard) and on the
// API; this is an optimistic redirect to avoid flashing the app when clearly
// signed out.
const SESSION_COOKIES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) =>
    request.cookies.has(name),
  );

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except the auth pages, Next internals and static assets.
  matcher: [
    "/((?!login|signup|verify-email|forgot-password|reset-password|onboarding|accept-invite|portal|_next/static|_next/image|favicon.ico|temetro-logo.png|avatars).*)",
  ],
};
