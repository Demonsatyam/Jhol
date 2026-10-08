import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jhol: is it a scam?",
  description: "Evidence-based scam checker for Indian messages, powered by live SerpApi searches.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
