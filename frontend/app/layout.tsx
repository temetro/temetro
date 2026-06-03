import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/components/i18n-provider";

// COSS font-variable contract: --font-sans, --font-heading, --font-mono.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const interHeading = Inter({ subsets: ["latin"], variable: "--font-heading" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "temetro — AI assistant for clinicians",
  description:
    "Retrieve patient information by simply asking. The open-source AI assistant for clinicians.",
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
        "font-sans"
      )}
    >
      {/* suppressHydrationWarning: next-themes sets the theme class on <html>
          before hydration, and browser extensions (e.g. ColorZilla's
          cz-shortcut-listen) mutate <body>. Only ignores attribute diffs on
          those elements, not their children. */}
      <body
        className="h-dvh overflow-hidden flex flex-col"
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
