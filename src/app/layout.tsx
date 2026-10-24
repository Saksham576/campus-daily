import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";
import { Toaster } from "@/components/Toaster";
import { Shortcuts } from "@/components/Shortcuts";

const sans = Inter({ subsets: ["latin"], variable: "--f-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Campus Daily",
  description: "Campus notices and self-updating timetable, personalized for IIT Bombay students.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Campus Daily", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <head>
        {/* Apply the saved light/dark choice before first paint */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('cd_theme');if(t)document.documentElement.dataset.theme=t}catch(e){}" }} />
      </head>
      <body>
        <a href="#main" className="skip">
          Skip to content
        </a>
        {children}
        <Toaster />
        <Shortcuts />
        <ServiceWorker />
      </body>
    </html>
  );
}
