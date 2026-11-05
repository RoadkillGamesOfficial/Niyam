import type { Metadata } from "next";
import { COPY, PRODUCT_NAME } from "@/copy";
import "./globals.css";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: COPY.metaDescription,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
