"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchApi } from "../../lib/api";
import { getConnection } from "../../lib/signalr";
import { useAuth } from "../../lib/auth";
import { Match, Market, Odd, OrderBookEntry } from "../../lib/types";

export default function MatchPage() {
  const { id } = useParams();
  const { user, refreshBalance } = useAuth();
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedOdd, setSelectedOdd] = useState<Odd | null>(null);
  const [orderBook, setOrderBook] = useState<{ backs: OrderBookEntry[]; lays: OrderBookEntry[] }>({ backs: [], lays: [] });
  const [side, setSide] = useState<"back" | "lay">("back");
  const [stake, setStake] = useState("");
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const loadOrderBook = useCallback(async (oddsId: number) => {
    const data = await fetchApi<{ backs: OrderBookEntry[]; lays: OrderBookEntry[] }>(`/orderbook/${oddsId}`);
    setOrderBook(data);
  }, []);

  // Load match and markets
  useEffect(() => {
    fetchApi<Match>(`/matches/${id}`).then(setMatch);
    fetchApi<Market[]>(`/markets/match/${id}`).then(setMarkets);
  }, [id]);

  // SignalR: subscribe to live odds
  useEffect(() => {
    const conn = getConnection();

    const start = async () => {
      if (conn.state === "Disconnected") await conn.start();
      await conn.invoke("JoinMatch", Number(id));
    };

    conn.on("OrderBookUpdated", (data: { oddsId: number; backs: OrderBookEntry[]; lays: OrderBookEntry[] }) => {
      setSelectedOdd((current) => {
        if (current && current.id === data.oddsId) {
          setOrderBook({ backs: data.backs, lays: data.lays });
        }
        return current;
      });
    });

    conn.on("OddsUpdated", (data: { marketId: number; odds: Odd[] }) => {
      setMarkets((prev) =>
        prev.map((m) =>
          m.id === data.marketId
            ? { ...m, odds: m.odds.map((o) => data.odds.find((u) => u.id === o.id) ?? o) }
            : m
        )
      );
      // Refresh order book if we're viewing an updated odd
      setSelectedOdd((current) => {
        if (current && data.odds.some((o) => o.id === current.id)) {
          const updated = data.odds.find((o) => o.id === current.id);
          if (updated) loadOrderBook(updated.id);
          return updated ?? current;
        }
        return current;
      });
    });

    start();

    return () => {
      conn.invoke("LeaveMatch", Number(id)).catch(() => {});
      conn.off("OddsUpdated");
      conn.off("OrderBookUpdated");
    };
  }, [id, loadOrderBook]);

  const selectOdd = (odd: Odd) => {
    setSelectedOdd(odd);
    loadOrderBook(odd.id);
  };

  const confirmTrade = () => {
    if (!selectedOdd || !stake || Number(stake) < 1) return;
    if (!user) { router.push("/login"); return; }
    setShowConfirm(true);
  };

  const placeTrade = async () => {
    if (!selectedOdd || !stake) return;
    setShowConfirm(false);
    setMessage("");
    try {
      const price = side === "back" ? selectedOdd.backPrice : selectedOdd.layPrice;
      const result = await fetchApi<{ id: number; status: string; balance: number }>("/trade", {
        method: "POST",
        body: JSON.stringify({ oddsId: selectedOdd.id, side, price, stake: Number(stake) }),
      });
      setMessage(`✅ Order #${result.id} placed (${result.status}). Balance: $${result.balance.toFixed(2)}`);
      setStake("");
      loadOrderBook(selectedOdd.id);
      refreshBalance();
    } catch (e: unknown) {
      setMessage(`❌ ${e instanceof Error ? e.message : "Error"}`);
    }
  };

  if (!match) return <p className="text-gray-400">Loading...</p>;

  return (
    <div>
      {/* Match Header */}
      <div className="mb-6">
        <span className="text-xs text-gray-400 uppercase">{match.sport}</span>
        <h1 className="text-2xl font-bold">
          {match.teamA} <span className="text-gray-500">vs</span> {match.teamB}
        </h1>
        <span className={`text-xs font-bold px-2 py-1 rounded ${match.status === "live" ? "bg-green-600" : "bg-gray-700"}`}>
          {match.status.toUpperCase()}
        </span>
      </div>

      {/* Odds Table */}
      {markets.map((market) => (
        <div key={market.id} className="mb-6">
          <h2 className="text-sm text-gray-400 mb-2">{market.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {market.odds.map((odd) => (
              <button
                key={odd.id}
                onClick={() => selectOdd(odd)}
                className={`rounded-lg p-3 text-center border transition ${
                  selectedOdd?.id === odd.id ? "border-yellow-400 bg-gray-800" : "border-gray-700 bg-gray-900 hover:border-gray-500"
                }`}
              >
                <p className="text-xs sm:text-sm text-gray-400">{odd.outcome}</p>
                <div className="flex justify-center gap-4 mt-1">
                  <span className="text-blue-400 font-bold">{odd.backPrice.toFixed(2)}</span>
                  <span className="text-pink-400 font-bold">{odd.layPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-center gap-4 text-[10px] text-gray-500">
                  <span>BACK</span>
                  <span>LAY</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Trade Panel + Order Book (side by side) */}
      {selectedOdd && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Trade Panel */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">Place Trade — {selectedOdd.outcome}</h3>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setSide("back")}
                className={`flex-1 py-2 rounded text-sm font-bold ${side === "back" ? "bg-blue-600" : "bg-gray-800 text-gray-400"}`}
              >
                BACK @ {selectedOdd.backPrice.toFixed(2)}
              </button>
              <button
                onClick={() => setSide("lay")}
                className={`flex-1 py-2 rounded text-sm font-bold ${side === "lay" ? "bg-pink-600" : "bg-gray-800 text-gray-400"}`}
              >
                LAY @ {selectedOdd.layPrice.toFixed(2)}
              </button>
            </div>
            <input
              type="number"
              placeholder="Stake ($1 – $5,000)"
              min={1}
              max={5000}
              step={1}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 mb-3 text-sm"
            />
            {stake && (
              <p className="text-xs text-gray-400 mb-3">
                Liability: $
                {side === "back"
                  ? Number(stake).toFixed(2)
                  : (Number(stake) * (selectedOdd.layPrice - 1)).toFixed(2)}
                {" | "}
                Potential profit: $
                {side === "back"
                  ? (Number(stake) * (selectedOdd.backPrice - 1)).toFixed(2)
                  : Number(stake).toFixed(2)}
              </p>
            )}
            <button
              onClick={confirmTrade}
              className="w-full bg-yellow-500 text-black font-bold py-2 rounded hover:bg-yellow-400 text-sm"
            >
              Place {side.toUpperCase()} Order
            </button>
            {message && <p className="mt-2 text-xs">{message}</p>}

            {/* Confirmation Modal */}
            {showConfirm && selectedOdd && (
              <div className="mt-3 bg-gray-800 border border-yellow-500 rounded-lg p-4">
                <p className="text-sm font-bold mb-2">Confirm Order</p>
                <div className="text-xs text-gray-300 space-y-1 mb-3">
                  <p>Outcome: <span className="text-white">{selectedOdd.outcome}</span></p>
                  <p>Side: <span className={side === "back" ? "text-blue-400" : "text-pink-400"}>{side.toUpperCase()}</span></p>
                  <p>Price: <span className="text-white">{(side === "back" ? selectedOdd.backPrice : selectedOdd.layPrice).toFixed(2)}</span></p>
                  <p>Stake: <span className="text-white">${Number(stake).toFixed(2)}</span></p>
                  <p>Liability: <span className="text-yellow-400">
                    ${side === "back" ? Number(stake).toFixed(2) : (Number(stake) * (selectedOdd.layPrice - 1)).toFixed(2)}
                  </span></p>
                </div>
                <div className="flex gap-2">
                  <button onClick={placeTrade} className="flex-1 bg-green-600 hover:bg-green-500 text-white text-sm font-bold py-2 rounded">Confirm</button>
                  <button onClick={() => setShowConfirm(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm py-2 rounded">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Order Book */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">Order Book — {selectedOdd.outcome}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-400 text-xs font-bold mb-1">BACKS (Buy)</p>
                {orderBook.backs.length === 0 && <p className="text-gray-600 text-xs">No orders</p>}
                {orderBook.backs.map((b, i) => (
                  <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-800">
                    <span className="text-blue-400">{b.price.toFixed(2)}</span>
                    <span className="text-gray-400">${b.totalStake.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-pink-400 text-xs font-bold mb-1">LAYS (Sell)</p>
                {orderBook.lays.length === 0 && <p className="text-gray-600 text-xs">No orders</p>}
                {orderBook.lays.map((l, i) => (
                  <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-800">
                    <span className="text-pink-400">{l.price.toFixed(2)}</span>
                    <span className="text-gray-400">${l.totalStake.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
