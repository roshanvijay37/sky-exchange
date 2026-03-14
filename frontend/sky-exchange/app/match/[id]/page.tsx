"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchApi } from "../../lib/api";
import { getConnection } from "../../lib/signalr";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { Match, Market, Odd, OrderBookEntry } from "../../lib/types";

const PLATFORM_CUT = 0.2;
const MARGIN = 0.10;

function getUserPrice(odd: Odd) {
  const wBack = odd.backPrice * (1 - MARGIN);
  const wLay = odd.layPrice * (1 + MARGIN);
  const spread = wLay - wBack;
  const cut = spread * PLATFORM_CUT;
  return wBack + (spread / 2) - cut;
}

function winAmount(price: number, stake: number) {
  return Math.round((price - 1) * stake * 100) / 100;
}

export default function MatchPage() {
  const { id } = useParams();
  const { user, refreshBalance } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedOdd, setSelectedOdd] = useState<Odd | null>(null);
  const [orderBook, setOrderBook] = useState<{ backs: OrderBookEntry[]; lays: OrderBookEntry[] }>({ backs: [], lays: [] });
  const [stake, setStake] = useState("");
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const loadOrderBook = useCallback(async (oddsId: number) => {
    const data = await fetchApi<{ backs: OrderBookEntry[]; lays: OrderBookEntry[] }>(`/orderbook/${oddsId}`);
    setOrderBook(data);
  }, []);

  useEffect(() => {
    fetchApi<Match>(`/matches/${id}`).then(setMatch);
    fetchApi<Market[]>(`/markets/match/${id}`).then(setMarkets);
  }, [id]);

  useEffect(() => {
    const conn = getConnection();
    const start = async () => {
      if (conn.state === "Disconnected") await conn.start();
      await conn.invoke("JoinMatch", Number(id));
    };
    conn.on("OrderBookUpdated", (data: { oddsId: number; backs: OrderBookEntry[]; lays: OrderBookEntry[] }) => {
      setSelectedOdd((current) => {
        if (current && current.id === data.oddsId) setOrderBook({ backs: data.backs, lays: data.lays });
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
    setStake("");
    setMessage("");
    setShowConfirm(false);
    loadOrderBook(odd.id);
  };

  const QUICK_BETS = [100, 200, 500, 1000, 2000, 3000];

  const setValidStake = (val: string) => {
    setStake(val);
    setShowConfirm(false);
    setMessage("");
  };

  const confirmTrade = () => {
    if (!selectedOdd || !stake) return;
    const s = Number(stake);
    if (s < 100 || s > 3000 || s % 100 !== 0) {
      setMessage("❌ Bet must be ₹100 to ₹3000 in multiples of ₹100");
      return;
    }
    if (!user) { router.push("/login"); return; }
    setShowConfirm(true);
  };

  const placeTrade = async () => {
    if (!selectedOdd || !stake) return;
    setShowConfirm(false);
    setMessage("");
    try {
      const price = selectedOdd.backPrice;
      const result = await fetchApi<{ id: number; status: string; balance: number }>("/trade", {
        method: "POST",
        body: JSON.stringify({ oddsId: selectedOdd.id, side: "back", price, stake: Number(stake) }),
      });
      const p = winAmount(getUserPrice(selectedOdd), Number(stake));
      setMessage(
        result.status === "matched"
          ? `🟢 ${t("betMatched")} ₹${Number(stake).toFixed(2)} ${t("on")} ${selectedOdd.outcome} — ${t("win")} ₹${p.toFixed(2)} ${t("profit")}!`
          : `🟡 ${t("betPlaced")}`
      );
      setStake("");
      loadOrderBook(selectedOdd.id);
      refreshBalance();
    } catch (e: unknown) {
      setMessage(`❌ ${e instanceof Error ? e.message : "Error"}`);
    }
  };

  if (!match) return <p className="text-gray-400">{t("loading")}</p>;

  const isSuspended = markets.some(m => m.status === "suspended");
  const effectivePrice = selectedOdd ? getUserPrice(selectedOdd) : 0;
  const stakeNum = Number(stake) || 0;
  const profit = winAmount(effectivePrice, stakeNum);

  return (
    <div>
      <div className="mb-6">
        <span className="text-xs text-gray-400 uppercase">{match.sport}</span>
        <h1 className="text-2xl font-bold">
          {match.teamA} <span className="text-gray-500">vs</span> {match.teamB}
        </h1>
        <span className={`text-xs font-bold px-2 py-1 rounded ${match.status === "live" ? "bg-green-600" : "bg-gray-700"}`}>
          {match.status === "live" ? t("live") : t("upcoming")}
        </span>
      </div>

      {isSuspended && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4 text-center">
          <p className="text-red-300 font-bold text-sm">⚠️ {t("suspended")}</p>
        </div>
      )}

      {markets.map((market) => (
        <div key={market.id} className="mb-6">
          <h2 className="text-sm text-gray-400 mb-3">{t("whoWillWin")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {market.odds.map((odd) => {
              const price = getUserPrice(odd);
              const win100 = winAmount(price, 100);
              return (
                <button
                  key={odd.id}
                  onClick={() => !isSuspended && selectOdd(odd)}
                  className={`rounded-xl p-4 text-center border-2 transition ${
                    isSuspended ? "border-gray-800 bg-gray-900 opacity-50 cursor-not-allowed" :
                    selectedOdd?.id === odd.id ? "border-yellow-400 bg-gray-800 scale-[1.02]" : "border-gray-700 bg-gray-900 hover:border-yellow-400/50"
                  }`}
                >
                  <p className="text-sm sm:text-base font-bold text-white">{odd.outcome}</p>
                  <p className="text-green-400 font-bold text-lg mt-2">
                    {t("bet")} ₹100 → {t("win")} ₹{win100.toFixed(0)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {selectedOdd && !isSuspended && (
        <div className="max-w-md mx-auto mt-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-bold text-lg mb-1">{selectedOdd.outcome}</h3>
            <p className="text-xs text-gray-400 mb-4">{t("bet")} ₹100 → {t("win")} ₹{winAmount(effectivePrice, 100).toFixed(0)} {t("profit")}</p>

            <label className="text-sm text-gray-400 mb-2 block">{t("enterAmount")}</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {QUICK_BETS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setValidStake(String(amt))}
                  className={`py-2.5 rounded-lg text-sm font-bold transition ${
                    Number(stake) === amt ? "bg-yellow-500 text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
            <input
              type="number"
              placeholder="₹100"
              min={100}
              max={3000}
              step={100}
              value={stake}
              onChange={(e) => setValidStake(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 mb-4 text-lg font-bold"
            />

            {stakeNum > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">{t("youBet")}</span>
                  <span className="text-white font-bold text-lg">₹{stakeNum.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-green-400">✅ {t("ifYouWin")}</span>
                  <span className="text-green-400 font-bold text-lg">+₹{profit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-red-400">❌ {t("ifYouLose")}</span>
                  <span className="text-red-400 font-bold text-lg">-₹{stakeNum.toFixed(2)}</span>
                </div>
              </div>
            )}

            {!showConfirm ? (
              <button
                onClick={confirmTrade}
                disabled={stakeNum < 100 || stakeNum > 3000 || stakeNum % 100 !== 0}
                className="w-full bg-yellow-500 text-black font-bold py-3 rounded-lg hover:bg-yellow-400 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("placeBet")}
              </button>
            ) : (
              <div className="bg-gray-800 border border-yellow-500 rounded-lg p-4">
                <p className="text-sm font-bold mb-2">{t("confirmBet")}</p>
                <p className="text-green-400 font-bold mb-1">₹{stakeNum.toFixed(2)} {t("on")} {selectedOdd.outcome} → {t("win")} ₹{profit.toFixed(2)}</p>
                <p className="text-red-400 text-xs mb-3">{t("ifWrongLose")} ₹{stakeNum.toFixed(2)}</p>
                <div className="flex gap-2">
                  <button onClick={placeTrade} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg">✅ {t("confirm")}</button>
                  <button onClick={() => setShowConfirm(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 rounded-lg">{t("cancel")}</button>
                </div>
              </div>
            )}

            {message && (
              <p className={`mt-3 text-sm font-semibold rounded-lg px-3 py-2 ${
                message.startsWith("🟢") ? "bg-green-900/50 border border-green-700 text-green-300" :
                message.startsWith("🟡") ? "bg-yellow-900/50 border border-yellow-700 text-yellow-300" :
                "bg-red-900/50 border border-red-700 text-red-300"
              }`}>{message}</p>
            )}
          </div>

          {(orderBook.backs.length > 0 || orderBook.lays.length > 0) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mt-3">
              <h3 className="text-sm text-gray-400 mb-2">{t("availableBets")}</h3>
              {orderBook.backs.map((b, i) => (
                <div key={`b${i}`} className="flex justify-between text-sm py-1.5 border-b border-gray-800">
                  <span className="text-gray-300">₹{b.totalStake.toFixed(0)} {t("available")}</span>
                  <span className="text-green-400">{t("win")} ₹{winAmount(b.price, 100).toFixed(0)} {t("per")} ₹100</span>
                </div>
              ))}
              {orderBook.lays.map((l, i) => (
                <div key={`l${i}`} className="flex justify-between text-sm py-1.5 border-b border-gray-800">
                  <span className="text-gray-300">₹{l.totalStake.toFixed(0)} {t("available")}</span>
                  <span className="text-green-400">{t("win")} ₹{winAmount(l.price, 100).toFixed(0)} {t("per")} ₹100</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
