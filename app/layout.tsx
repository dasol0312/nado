import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "nado",
  description: "Pick an activity. Find your people. Say nado.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
