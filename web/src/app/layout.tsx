import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { TopNav } from "@/components/top-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "StratIQ",
  description: "Executive churn strategy workflow prototype",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      style={
        {
          "--font-display": '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
          "--font-body": '"Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        } as CSSProperties
      }
    >
      <body>
        <div className="app-shell">
          <TopNav />
          <main className="app-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
