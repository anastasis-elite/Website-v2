import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anastasis | Woman-Centered Performance",
  description:
    "A luxury, woman-centered training experience built around female physiology, nervous system safety, and sustainable performance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
