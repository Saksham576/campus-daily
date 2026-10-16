import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black, Doto, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";

const sign = Archivo_Black({ subsets: ["latin"], weight: "400", variable: "--f-sign", display: "swap" });
const sans = Archivo({ subsets: ["latin"], variable: "--f-sans", display: "swap" });
const led = Doto({ subsets: ["latin"], variable: "--f-led", display: "swap" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--f-deva", display: "swap" });

export const metadata: Metadata = {
  title: "Campus Daily",
  description: "Campus notices and self-updating timetable, personalized for IIT Bombay students.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Campus Daily", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ffcc00",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sign.variable} ${sans.variable} ${led.variable} ${deva.variable}`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
