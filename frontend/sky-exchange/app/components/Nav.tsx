"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/auth";

export default function Nav() {
  const { user, logout, refreshBalance } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (user) refreshBalance();
  }, []);

  return (
    <>
      {/* Top bar */}
      <nav className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/" className="text-lg sm:text-xl font-bold text-yellow-400">⚡ Sky Exchange</Link>
            <div className="hidden sm:flex items-center gap-4">
              <Link href="/" className="text-gray-300 hover:text-white text-sm">Matches</Link>
              {user && <Link href="/positions" className="text-gray-300 hover:text-white text-sm">My Bets</Link>}
              {user?.isAdmin && <Link href="/admin" className="text-gray-300 hover:text-white text-sm">Admin</Link>}
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 text-sm">
            {user ? (
              <>
                <span className="text-yellow-400 font-semibold">₹{user.balance.toFixed(2)}</span>
                <span className="hidden sm:inline text-gray-600">|</span>
                <span className="hidden sm:inline text-gray-400">{user.username}</span>
                <button onClick={logout} className="hidden sm:inline text-red-400 hover:text-red-300">Logout</button>
              </>
            ) : (
              <Link href="/login" className="text-yellow-400 hover:text-yellow-300">Login</Link>
            )}
          </div>
        </div>
      </nav>

      {/* Bottom nav — mobile only */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-50">
        <div className="flex justify-around items-center py-2">
          <Link href="/" className={`flex flex-col items-center gap-0.5 px-3 py-1 ${pathname === "/" ? "text-yellow-400" : "text-gray-500"}`}>
            <span className="text-lg">🏏</span>
            <span className="text-[10px] font-bold">Matches</span>
          </Link>
          {user ? (
            <>
              <Link href="/positions" className={`flex flex-col items-center gap-0.5 px-3 py-1 ${pathname === "/positions" ? "text-yellow-400" : "text-gray-500"}`}>
                <span className="text-lg">📋</span>
                <span className="text-[10px] font-bold">My Bets</span>
              </Link>
              {user.isAdmin && (
                <Link href="/admin" className={`flex flex-col items-center gap-0.5 px-3 py-1 ${pathname === "/admin" ? "text-yellow-400" : "text-gray-500"}`}>
                  <span className="text-lg">⚙️</span>
                  <span className="text-[10px] font-bold">Admin</span>
                </Link>
              )}
              <button onClick={logout} className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-500">
                <span className="text-lg">🚪</span>
                <span className="text-[10px] font-bold">Logout</span>
              </button>
            </>
          ) : (
            <Link href="/login" className={`flex flex-col items-center gap-0.5 px-3 py-1 ${pathname === "/login" ? "text-yellow-400" : "text-gray-500"}`}>
              <span className="text-lg">👤</span>
              <span className="text-[10px] font-bold">Login</span>
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
