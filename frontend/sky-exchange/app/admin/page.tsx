"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Match, Market } from "../lib/types";

interface AdminUser {
  id: number;
  username: string;
  balance: number;
  isAdmin: boolean;
  isSuspended: boolean;
  createdAt: string;
  orderCount: number;
  tradeCount: number;
}

interface MatchStat {
  id: number;
  match: string;
  status: string;
  orders: number;
  trades: number;
  volume: number;
}

interface TopTrader {
  username: string;
  balance: number;
  trades: number;
  volume: number;
}

interface Dashboard {
  totalUsers: number;
  activeUsers: number;
  totalOrders: number;
  todayOrders: number;
  pendingOrders: number;
  totalTrades: number;
  todayTrades: number;
  totalVolume: number;
  todayVolume: number;
  totalBalances: number;
  platformPnl: number;
  matchStats: MatchStat[];
  topTraders: TopTrader[];
}

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"dashboard" | "matches" | "users">("dashboard");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [adjustId, setAdjustId] = useState<number | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const loadAll = () => {
    fetchApi<Dashboard>("/admin/dashboard").then(setDashboard);
    fetchApi<Match[]>("/matches").then(setMatches);
    fetchApi<AdminUser[]>("/admin/users").then(setUsers);
  };

  useEffect(() => {
    if (!user?.isAdmin) { router.push("/"); return; }
    loadAll();
  }, [user, router]);

  // Match settlement
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
      setSelectedMatch(null);
      setMarkets([]);
      loadAll();
    } catch (e: unknown) {
      setMessage(`❌ ${e instanceof Error ? e.message : "Error"}`);
    }
  };

  // User management
  const toggleSuspend = async (userId: number) => {
    const u = users.find(u => u.id === userId);
    if (!confirm(`${u?.isSuspended ? "Unsuspend" : "Suspend"} user "${u?.username}"?`)) return;
    await fetchApi(`/admin/users/${userId}/suspend`, { method: "POST" });
    loadAll();
  };

  const submitAdjust = async () => {
    if (!adjustId || !adjustAmount) return;
    await fetchApi(`/admin/users/${adjustId}/adjust`, {
      method: "POST",
      body: JSON.stringify({ amount: Number(adjustAmount), reason: adjustReason }),
    });
    setAdjustId(null);
    setAdjustAmount("");
    setAdjustReason("");
    loadAll();
  };

  const activeMatches = matches.filter((m) => m.status !== "completed");
  const completedMatches = matches.filter((m) => m.status === "completed");

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold mb-4">⚙️ Admin Panel</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {(["dashboard", "matches", "users"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-t text-sm font-bold capitalize ${tab === t ? "bg-gray-900 text-white" : "bg-gray-800 text-gray-500"}`}
          >
            {t === "users" ? `Users (${users.length})` : t}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {tab === "dashboard" && dashboard && (
        <div>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard label="Total Users" value={dashboard.totalUsers} />
            <StatCard label="Active (7d)" value={dashboard.activeUsers} />
            <StatCard label="Pending Orders" value={dashboard.pendingOrders} />
            <StatCard label="Total Trades" value={dashboard.totalTrades} />
            <StatCard label="Today Orders" value={dashboard.todayOrders} />
            <StatCard label="Today Trades" value={dashboard.todayTrades} />
            <StatCard label="Total Volume" value={`$${dashboard.totalVolume.toFixed(2)}`} />
            <StatCard label="Today Volume" value={`$${dashboard.todayVolume.toFixed(2)}`} />
          </div>

          {/* Platform P&L */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
            <h3 className="text-sm text-gray-400 mb-2">Platform Overview</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Total User Balances</p>
                <p className="text-lg font-bold text-yellow-400">${dashboard.totalBalances.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Platform P&L</p>
                <p className={`text-lg font-bold ${dashboard.platformPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {dashboard.platformPnl >= 0 ? "+" : ""}${dashboard.platformPnl.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Orders</p>
                <p className="text-lg font-bold text-white">{dashboard.totalOrders}</p>
              </div>
            </div>
          </div>

          {/* Active Match Stats */}
          {dashboard.matchStats.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm text-gray-400 mb-2">Active Matches</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="text-gray-400 text-left border-b border-gray-800">
                      <th className="py-2">Match</th>
                      <th>Status</th>
                      <th>Pending</th>
                      <th>Trades</th>
                      <th>Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.matchStats.map((m) => (
                      <tr key={m.id} className="border-b border-gray-800/50">
                        <td className="py-2">{m.match}</td>
                        <td>
                          <span className={`text-xs px-2 py-0.5 rounded ${m.status === "live" ? "bg-green-600" : "bg-gray-700"}`}>
                            {m.status.toUpperCase()}
                          </span>
                        </td>
                        <td>{m.orders}</td>
                        <td>{m.trades}</td>
                        <td className="text-yellow-400">${m.volume.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Traders */}
          {dashboard.topTraders.length > 0 && (
            <div>
              <h3 className="text-sm text-gray-400 mb-2">Top Traders (by volume)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[400px]">
                  <thead>
                    <tr className="text-gray-400 text-left border-b border-gray-800">
                      <th className="py-2">User</th>
                      <th>Balance</th>
                      <th>Trades</th>
                      <th>Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.topTraders.map((t, i) => (
                      <tr key={i} className="border-b border-gray-800/50">
                        <td className="py-2">{t.username}</td>
                        <td className="text-yellow-400">${t.balance.toFixed(2)}</td>
                        <td>{t.trades}</td>
                        <td>${t.volume.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      {tab === "dashboard" && !dashboard && <p className="text-gray-500">Loading...</p>}

      {/* Matches Tab */}
      {tab === "matches" && (
        <>
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

          {selectedMatch && markets.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
              <h3 className="font-bold mb-3">
                Settle: {selectedMatch.teamA} vs {selectedMatch.teamB}
              </h3>
              <p className="text-sm text-gray-400 mb-3">Select the winning outcome:</p>
              <div className="flex flex-wrap gap-2">
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
        </>
      )}

      {/* Users Tab */}
      {tab === "users" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-gray-400 text-left border-b border-gray-800">
                <th className="py-2">User</th>
                <th>Balance</th>
                <th>Orders</th>
                <th>Trades</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={`border-b border-gray-800/50 ${u.isSuspended ? "opacity-50" : ""}`}>
                  <td className="py-2">
                    {u.username}
                    {u.isAdmin && <span className="ml-1 text-xs text-yellow-400">(admin)</span>}
                  </td>
                  <td className="text-yellow-400 font-semibold">${u.balance.toFixed(2)}</td>
                  <td>{u.orderCount}</td>
                  <td>{u.tradeCount}</td>
                  <td className="text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    {u.isSuspended ? (
                      <span className="text-xs text-red-400">Suspended</span>
                    ) : (
                      <span className="text-xs text-green-400">Active</span>
                    )}
                  </td>
                  <td className="space-x-2">
                    {!u.isAdmin && (
                      <button
                        onClick={() => toggleSuspend(u.id)}
                        className={`text-xs px-2 py-1 rounded ${
                          u.isSuspended
                            ? "bg-green-900 text-green-300 hover:bg-green-800"
                            : "bg-red-900 text-red-300 hover:bg-red-800"
                        }`}
                      >
                        {u.isSuspended ? "Unsuspend" : "Suspend"}
                      </button>
                    )}
                    <button
                      onClick={() => setAdjustId(adjustId === u.id ? null : u.id)}
                      className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded hover:bg-gray-700"
                    >
                      Adjust $
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {adjustId && (
            <div className="mt-4 bg-gray-900 border border-gray-800 rounded-lg p-4 max-w-sm">
              <h3 className="font-bold text-sm mb-2">
                Adjust Balance — {users.find(u => u.id === adjustId)?.username}
              </h3>
              <input
                type="number"
                placeholder="Amount (negative to deduct)"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 mb-2 text-sm"
              />
              <input
                type="text"
                placeholder="Reason (optional)"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 mb-2 text-sm"
              />
              <div className="flex gap-2">
                <button onClick={submitAdjust} className="bg-yellow-500 text-black text-sm font-bold px-4 py-2 rounded hover:bg-yellow-400">Apply</button>
                <button onClick={() => setAdjustId(null)} className="bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded hover:bg-gray-600">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  );
}
