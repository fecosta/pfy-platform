import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Portuguese for You",
  description: "Portuguese for You learning platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
