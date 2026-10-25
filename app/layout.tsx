import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import AppProvider from "@/components/shell/AppProvider";
import AppShell from "@/components/shell/AppShell";
import { sessionStudentId } from "@/lib/server/session";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-display" });
const body = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Nado",
  description: "Others ask, “Who’s in?” You say: nado. Plans with NYU students who are free when you are.",
  icons: { icon: "/mascot.webp", apple: "/mascot.webp" },
  // Added to the Home Screen: full screen, content runs under the status bar (safe-area padding handles it)
  appleWebApp: { capable: true, title: "Nado", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};
// viewportFit cover lets the app use the whole screen; safe-area insets in globals.css keep it clear
// of the notch and home indicator. themeColor tints Safari's toolbar to match the app background.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfafd" },
    { media: "(prefers-color-scheme: dark)", color: "#15111b" },
  ],
};

// Who's signed in (null on the login screen). Pages check again before showing data.
async function signedIn() {
  const id = await sessionStudentId();
  if (!id) return null;
  const sb = await createClient();
  const { data } = await sb.from("students").select("id, nickname, email").eq("id", id).maybeSingle();
  return data;
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const me = await signedIn();
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <AppProvider me={me}>
          <div className="stage">
            <AppShell>{children}</AppShell>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
