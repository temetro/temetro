import type { Metadata } from "next";
import { Geist_Mono, IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { ToastProvider } from "@/components/ui/toast";

// COSS font-variable contract: --font-sans, --font-heading, --font-mono.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const interHeading = Inter({ subsets: ["latin"], variable: "--font-heading" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
// Arabic-capable fallback: Inter has no Arabic glyphs, so we append this to the
// sans/heading stacks (see globals.css) for per-character fallback in every
// locale, and rely on it fully when dir="rtl". Not a variable font — pin weights.
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
});

// Runs before first paint: mirror lib/i18n/config.ts `dirFor` so an Arabic user
// gets dir="rtl" immediately instead of a flash of LTR. Detection order matches
// i18next-browser-languagedetector (localStorage key "i18nextLng", then the
// browser language). suppressHydrationWarning on <html> ignores the attr diff.
const setInitialDir = `
(function(){try{
  var l=localStorage.getItem("i18nextLng")||navigator.language||"en";
  var e=document.documentElement;
  e.lang=l;
  e.dir=l.indexOf("ar")===0?"rtl":"ltr";
}catch(_){}})();
`;

export const metadata: Metadata = {
  title: "temetro — AI assistant for clinicians",
  description:
    "Retrieve patient information by simply asking. The open-source AI assistant for clinicians.",
  // Icons come from the app/icon.png + app/apple-icon.png file conventions.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        inter.variable,
        interHeading.variable,
        geistMono.variable,
        plexArabic.variable,
        "font-sans"
      )}
    >
      {/* suppressHydrationWarning: next-themes sets the theme class on <html>
          before hydration, the dir script below sets lang/dir, and browser
          extensions (e.g. ColorZilla's cz-shortcut-listen) mutate <body>. Only
          ignores attribute diffs on those elements, not their children. */}
      <body
        className="h-dvh overflow-hidden flex flex-col"
        suppressHydrationWarning
      >
        <script
          // Sets <html dir/lang> before paint; see setInitialDir above.
          dangerouslySetInnerHTML={{ __html: setInitialDir }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>
            <I18nProvider>{children}</I18nProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
