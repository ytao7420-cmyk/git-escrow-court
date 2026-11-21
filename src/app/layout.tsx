import type { Metadata } from "next";
import { IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";

import { SiteHeader } from "@/components/site-header";

import "./globals.css";

const source = Source_Serif_4({ subsets: ["latin"], variable: "--font-source" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex" });

export const metadata: Metadata = {
  title: "Git escrow court",
  description: "One local review loop from an Arkhai git-escrow receipt to a GenLayer judgment.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hans">
      <body className={`${source.variable} ${plex.variable} antialiased`}>
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
