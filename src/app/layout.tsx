import type { Metadata } from "next";
import "./globals.css";
import { DataProvider } from "@/lib/DataContext";
import AuthProvider from "@/components/AuthProvider";

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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </head>
      <body><AuthProvider><DataProvider>{children}</DataProvider></AuthProvider></body>
    </html>
  );
}
