"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Position } from "../lib/types";

export default function PositionsPage() {
  const { user, refreshBalance } = useAuth();
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);

  const load = () => {
    fetchApi<{ balance: number }>("/user/me").then((u) => setBalance(u.balance));
    fetchApi<Position[]>("/user/me/positions").then(setPositions);
  };

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    load();
  }, [user, router]);

  const cancelOrder = async (orderId: number) => {
    try {
      const result = await fetchApi<{ id: number; status: string; balance: number }>(
        `/trade/${orderId}`,
        { method: "DELETE" }
      );
      setBalance(result.balance);
      load();
      refreshBalance();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error cancelling order");
    }
  };

  if (!user) return null;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">My Positions</h1>
        {balance !== null && (
          <span className="bg-gray-900 border border-gray-700 px-4 py-2 rounded text-sm">
            Balance: <span className="text-yellow-400 font-bold">${balance.toFixed(2)}</span>
          </span>
        )}
      </div>

      {positions.length === 0 ? (
        <p className="text-gray-500">No trades yet. Go place some orders!</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left border-b border-gray-800">
              <th className="py-2">Outcome</th>
              <th>Side</th>
              <th>Price</th>
              <th>Stake</th>
              <th>Status</th>
              <th>Time</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.id} className="border-b border-gray-800/50">
                <td className="py-2">{p.outcome}</td>
                <td>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.side === "back" ? "bg-blue-900 text-blue-300" : "bg-pink-900 text-pink-300"}`}>
                    {p.side.toUpperCase()}
                  </span>
                </td>
                <td>{p.price.toFixed(2)}</td>
                <td>${p.stake.toFixed(2)}</td>
                <td>
                  <span className={`text-xs ${
                    p.status === "matched" ? "text-green-400"
                    : p.status === "pending" ? "text-yellow-400"
                    : p.status === "cancelled" ? "text-red-400"
                    : "text-gray-400"
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="text-gray-500">{new Date(p.createdAt).toLocaleTimeString()}</td>
                <td>
                  {p.status === "pending" && (
                    <button
                      onClick={() => cancelOrder(p.id)}
                      className="text-xs bg-red-900 text-red-300 px-2 py-1 rounded hover:bg-red-800"
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
