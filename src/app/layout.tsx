import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Commute Alert",
  description: "Traffic alert automation for your commute using Google Maps and notifications."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
