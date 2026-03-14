import type { Metadata } from "next";
import "./globals.css";
import Nav from "./components/Nav";
import Toasts from "./components/Toasts";
import { AuthProvider } from "./lib/auth";

export const metadata: Metadata = {
  title: "Sky Exchange",
  description: "Sports Trading Exchange Prototype",
  manifest: "/manifest.json",
  themeColor: "#eab308",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="bg-gray-950 text-white min-h-screen">
        <AuthProvider>
          <Nav />
          <main className="max-w-5xl mx-auto px-3 py-3 sm:p-4">{children}</main>
          <Toasts />
          <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')` }} />
        </AuthProvider>
      </body>
    </html>
  );
}
