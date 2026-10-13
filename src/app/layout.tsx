import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campus Daily",
  description: "Campus notices and self-updating timetable, personalized for IIT Bombay students.",
};

export const viewport: Viewport = {
  themeColor: "#16181A",
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
