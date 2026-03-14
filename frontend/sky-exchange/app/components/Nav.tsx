"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../lib/auth";

export default function Nav() {
  const { user, logout, refreshBalance } = useAuth();

  useEffect(() => {
    if (user) refreshBalance();
  }, []);

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-xl font-bold text-yellow-400">⚡ Sky Exchange</Link>
        <Link href="/" className="text-gray-300 hover:text-white text-sm">Matches</Link>
        {user && <Link href="/positions" className="text-gray-300 hover:text-white text-sm">My Positions</Link>}
        {user?.isAdmin && <Link href="/admin" className="text-gray-300 hover:text-white text-sm">Admin</Link>}
      </div>
      <div className="flex items-center gap-4 text-sm">
        {user ? (
          <>
            <span className="text-yellow-400 font-semibold">${user.balance.toFixed(2)}</span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">{user.username}</span>
            <button onClick={logout} className="text-red-400 hover:text-red-300">Logout</button>
          </>
        ) : (
          <Link href="/login" className="text-yellow-400 hover:text-yellow-300">Login</Link>
        )}
      </div>
    </nav>
  );
}
