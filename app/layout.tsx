import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OfficeHub — HR Management",
  description: "A full-stack office & HR management dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
