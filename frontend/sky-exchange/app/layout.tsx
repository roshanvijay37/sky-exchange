import type { Metadata } from "next";
import "./globals.css";
import Nav from "./components/Nav";

export const metadata: Metadata = {
  title: "Sky Exchange",
  description: "Sports Trading Exchange Prototype",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen">
        <Nav />
        <main className="max-w-5xl mx-auto p-4">{children}</main>
      </body>
    </html>
  );
}
