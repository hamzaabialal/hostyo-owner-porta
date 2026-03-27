import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hostyo Owner Portal",
  description: "Property management owner portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="light only" />
      </head>
      <body>{children}</body>
    </html>
  );
}
