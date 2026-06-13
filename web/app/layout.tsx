import "./globals.css";
import type { Metadata } from "next";
import { Anton, Inter } from "next/font/google";

const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Reach — AI-native CRM for consumer brands",
  description:
    "An AI-native CRM that wins back lapsed shoppers across WhatsApp, SMS & Email — and proves the recovered revenue.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen font-sans text-white antialiased">{children}</body>
    </html>
  );
}
