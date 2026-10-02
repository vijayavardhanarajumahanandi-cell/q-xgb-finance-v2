import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Q-XGB Finance",
  description: "Hybrid quantum-classical financial machine-learning research platform.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
