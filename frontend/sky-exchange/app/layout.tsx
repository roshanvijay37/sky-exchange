import type { Metadata } from "next";
import "./globals.css";
import Nav from "./components/Nav";
import { AuthProvider } from "./lib/auth";

export const metadata: Metadata = {
  title: "Sky Exchange",
  description: "Sports Trading Exchange Prototype",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen">
        <AuthProvider>
          <Nav />
          <main className="max-w-5xl mx-auto p-4">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
