import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Taco Town — AI Win-Back CRM",
  description: "An AI agent that wins back lapsed shoppers and proves the recovered revenue.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-neutral-100 antialiased">{children}</body>
    </html>
  );
}
