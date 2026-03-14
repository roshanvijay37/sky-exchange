"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { Position, TradeHistory } from "../lib/types";

export default function PositionsPage() {
  const { user, refreshBalance } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<"orders" | "trades">("orders");
  const [balance, setBalance] = useState<number | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<TradeHistory[]>([]);

  const load = () => {
    fetchApi<{ balance: number }>("/user/me").then((u) => setBalance(u.balance));
    fetchApi<Position[]>("/user/me/positions").then(setPositions);
    fetchApi<TradeHistory[]>("/user/me/trades").then(setTrades);
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
      alert(e instanceof Error ? e.message : "Error");
    }
  };

  if (!user) return null;

  const totalPnl = trades.filter(t => t.pnlStatus !== "open").reduce((sum, t) => sum + t.pnl, 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
        <h1 className="text-xl sm:text-2xl font-bold">{t("myPositions")}</h1>
        <div className="flex items-center gap-4">
          {trades.length > 0 && (
            <span className={`text-sm font-bold ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              {t("pnl")}: {totalPnl >= 0 ? "+" : ""}₹{totalPnl.toFixed(2)}
            </span>
          )}
          {balance !== null && (
            <span className="bg-gray-900 border border-gray-700 px-4 py-2 rounded text-sm">
              {t("balance")}: <span className="text-yellow-400 font-bold">₹{balance.toFixed(2)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setTab("orders")}
          className={`px-4 py-2 rounded-t text-sm font-bold ${tab === "orders" ? "bg-gray-900 text-white" : "bg-gray-800 text-gray-500"}`}
        >
          {t("openOrders")} ({positions.filter(p => p.status === "pending").length})
        </button>
        <button
          onClick={() => setTab("trades")}
          className={`px-4 py-2 rounded-t text-sm font-bold ${tab === "trades" ? "bg-gray-900 text-white" : "bg-gray-800 text-gray-500"}`}
        >
          {t("tradeHistory")} ({trades.length})
        </button>
      </div>

      {tab === "orders" && (
        positions.length === 0 ? (
          <p className="text-gray-500">{t("noOrders")}</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="text-gray-400 text-left border-b border-gray-800">
                <th className="py-2">{t("outcome")}</th>
                <th>{t("side")}</th>
                <th>{t("price")}</th>
                <th>{t("stake")}</th>
                <th>{t("status")}</th>
                <th>{t("time")}</th>
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
                  <td>₹{p.stake.toFixed(2)}</td>
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
                        {t("cancelOrder")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )
      )}

      {tab === "trades" && (
        trades.length === 0 ? (
          <p className="text-gray-500">{t("noTrades")}</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-gray-400 text-left border-b border-gray-800">
                <th className="py-2">{t("match")}</th>
                <th>{t("outcome")}</th>
                <th>{t("side")}</th>
                <th>{t("price")}</th>
                <th>{t("stake")}</th>
                <th>{t("pnl")}</th>
                <th>{t("time")}</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((tr) => (
                <tr key={tr.id} className="border-b border-gray-800/50">
                  <td className="py-2 text-gray-300">{tr.match}</td>
                  <td>{tr.outcome}</td>
                  <td>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${tr.side === "back" ? "bg-blue-900 text-blue-300" : "bg-pink-900 text-pink-300"}`}>
                      {tr.side.toUpperCase()}
                    </span>
                  </td>
                  <td>{tr.price.toFixed(2)}</td>
                  <td>₹{tr.stake.toFixed(2)}</td>
                  <td>
                    {tr.pnlStatus === "open" ? (
                      <span className="text-xs text-yellow-400">{t("open")}</span>
                    ) : (
                      <span className={`text-xs font-bold ${tr.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {tr.pnl >= 0 ? "+" : ""}₹{tr.pnl.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="text-gray-500">{new Date(tr.createdAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )
      )}
    </div>
  );
}
