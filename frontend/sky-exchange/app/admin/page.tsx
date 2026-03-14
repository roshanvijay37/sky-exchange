"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Match, Market } from "../lib/types";

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user?.isAdmin) { router.push("/"); return; }
    fetchApi<Match[]>("/matches").then(setMatches);
  }, [user, router]);

  const selectMatch = async (match: Match) => {
    setSelectedMatch(match);
    setMessage("");
    const data = await fetchApi<Market[]>(`/markets/match/${match.id}`);
    setMarkets(data);
  };

  const settle = async (outcome: string) => {
    if (!selectedMatch) return;
    if (!confirm(`Settle "${selectedMatch.teamA} vs ${selectedMatch.teamB}" with winner: ${outcome}?`)) return;
    try {
      const result = await fetchApi<{ message: string; payouts: { user: string; amount: number; result: string }[] }>(
        `/admin/settle/${selectedMatch.id}`,
        { method: "POST", body: JSON.stringify({ winningOutcome: outcome }) }
      );
      setMessage(`✅ ${result.message} — ${result.payouts.length} payout(s) processed`);
      fetchApi<Match[]>("/matches").then(setMatches);
      setSelectedMatch(null);
      setMarkets([]);
    } catch (e: unknown) {
      setMessage(`❌ ${e instanceof Error ? e.message : "Error"}`);
    }
  };

  const activeMatches = matches.filter((m) => m.status !== "completed");
  const completedMatches = matches.filter((m) => m.status === "completed");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">⚙️ Admin — Settle Matches</h1>

      {/* Active Matches */}
      <h2 className="text-sm text-gray-400 mb-2">Active Matches</h2>
      <div className="grid gap-2 mb-6">
        {activeMatches.map((m) => (
          <button
            key={m.id}
            onClick={() => selectMatch(m)}
            className={`bg-gray-900 border rounded-lg p-3 text-left transition ${
              selectedMatch?.id === m.id ? "border-yellow-400" : "border-gray-800 hover:border-gray-600"
            }`}
          >
            <span className="text-xs text-gray-400">{m.sport}</span>
            <p className="font-semibold">{m.teamA} vs {m.teamB}</p>
            <span className={`text-xs px-2 py-0.5 rounded ${m.status === "live" ? "bg-green-600" : "bg-gray-700"}`}>
              {m.status.toUpperCase()}
            </span>
          </button>
        ))}
        {activeMatches.length === 0 && <p className="text-gray-500 text-sm">No active matches</p>}
      </div>

      {/* Settlement Panel */}
      {selectedMatch && markets.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
          <h3 className="font-bold mb-3">
            Settle: {selectedMatch.teamA} vs {selectedMatch.teamB}
          </h3>
          <p className="text-sm text-gray-400 mb-3">Select the winning outcome:</p>
          <div className="flex gap-2">
            {markets[0].odds.map((odd) => (
              <button
                key={odd.id}
                onClick={() => settle(odd.outcome)}
                className="bg-green-800 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-bold"
              >
                {odd.outcome}
              </button>
            ))}
          </div>
          {message && <p className="mt-3 text-sm">{message}</p>}
        </div>
      )}

      {/* Completed Matches */}
      {completedMatches.length > 0 && (
        <>
          <h2 className="text-sm text-gray-400 mb-2">Completed Matches</h2>
          <div className="grid gap-2">
            {completedMatches.map((m) => (
              <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 opacity-60">
                <span className="text-xs text-gray-400">{m.sport}</span>
                <p className="font-semibold">{m.teamA} vs {m.teamB}</p>
                <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">COMPLETED</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
