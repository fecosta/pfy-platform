import type { Metadata } from "next";
import { Lora, Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";

const productFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-product",
});

const brandFont = Lora({
  subsets: ["latin"],
  variable: "--font-brand",
});

export const metadata: Metadata = {
  title: "Portuguese for You",
  description: "Portuguese for You learning platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${productFont.variable} ${brandFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
