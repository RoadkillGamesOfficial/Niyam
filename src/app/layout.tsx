import type { Metadata } from "next";
import { COPY, PRODUCT_NAME } from "@/copy";
import { ReframeShortcut } from "./reframe-shortcut";
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
      <body>
        <div className="world" aria-hidden="true">
          <span className="cloud cloud-a" />
          <span className="cloud cloud-b" />
          <span className="cloud cloud-c" />
          <span className="grass-strip" />
        </div>
        <ReframeShortcut />
        {children}
      </body>
    </html>
  );
}
