import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import { TopNav } from "@/components/top-nav";
import "./globals.css";

const displayFont = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const bodyFont = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
});

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
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <div className="app-shell">
          <TopNav />
          <main className="app-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
