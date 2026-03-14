"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "../lib/api";
import { Position } from "../lib/types";

export default function PositionsPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    fetchApi<{ balance: number }>("/user/1").then((u) => setBalance(u.balance));
    fetchApi<Position[]>("/user/1/positions").then(setPositions);
  }, []);

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
                  <span className={`text-xs ${p.status === "matched" ? "text-green-400" : p.status === "pending" ? "text-yellow-400" : "text-gray-400"}`}>
                    {p.status}
                  </span>
                </td>
                <td className="text-gray-500">{new Date(p.createdAt).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
