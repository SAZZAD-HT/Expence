import type { Metadata } from "next";
import { Unbounded, JetBrains_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import ModeProvider from "@/components/mode-provider";

const unbounded = Unbounded({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const plex = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Night Market — Expense Manager",
  description: "Private financial dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${unbounded.variable} ${jetbrains.variable} ${plex.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ModeProvider />
        <div className="aurora-bg" aria-hidden />
        <div className="scanlines" aria-hidden />
        {children}
      </body>
    </html>
  );
}
