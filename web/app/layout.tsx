import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Hedge Fund — Dashboard",
  description:
    "Build a fund, staff it with LLM investor agents and quant models, and run a live cycle.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
