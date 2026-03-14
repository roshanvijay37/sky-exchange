"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../lib/auth";

export default function Nav() {
  const { user, logout, refreshBalance } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user) refreshBalance();
  }, []);

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="text-lg sm:text-xl font-bold text-yellow-400">⚡ Sky Exchange</Link>
          <div className="hidden sm:flex items-center gap-4">
            <Link href="/" className="text-gray-300 hover:text-white text-sm">Matches</Link>
            {user && <Link href="/positions" className="text-gray-300 hover:text-white text-sm">My Positions</Link>}
            {user?.isAdmin && <Link href="/admin" className="text-gray-300 hover:text-white text-sm">Admin</Link>}
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-sm">
          {user ? (
            <>
              <span className="text-yellow-400 font-semibold">${user.balance.toFixed(2)}</span>
              <span className="hidden sm:inline text-gray-600">|</span>
              <span className="hidden sm:inline text-gray-400">{user.username}</span>
              <button onClick={logout} className="hidden sm:inline text-red-400 hover:text-red-300">Logout</button>
              <button onClick={() => setOpen(!open)} className="sm:hidden text-gray-400 text-xl">☰</button>
            </>
          ) : (
            <Link href="/login" className="text-yellow-400 hover:text-yellow-300">Login</Link>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {open && user && (
        <div className="sm:hidden mt-3 pt-3 border-t border-gray-800 flex flex-col gap-3">
          <span className="text-gray-400 text-sm">{user.username}</span>
          <Link href="/" onClick={() => setOpen(false)} className="text-gray-300 text-sm">Matches</Link>
          <Link href="/positions" onClick={() => setOpen(false)} className="text-gray-300 text-sm">My Positions</Link>
          {user.isAdmin && <Link href="/admin" onClick={() => setOpen(false)} className="text-gray-300 text-sm">Admin</Link>}
          <button onClick={() => { logout(); setOpen(false); }} className="text-red-400 text-sm text-left">Logout</button>
        </div>
      )}
    </nav>
  );
}
