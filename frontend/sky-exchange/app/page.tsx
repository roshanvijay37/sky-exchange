"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchApi } from "./lib/api";
import { Match } from "./lib/types";
import { useI18n } from "./lib/i18n";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    + " · "
    + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export default function Home() {
  const [matches, setMatches] = useState<Match[]>([]);
  const { t } = useI18n();

  useEffect(() => {
    fetchApi<Match[]>("/matches").then(setMatches);
  }, []);

  const statusLabel = (s: string) => {
    if (s === "live") return t("live");
    if (s === "completed") return t("completed");
    return t("upcoming");
  };

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold mb-4">{t("liveUpcoming")}</h1>
      <div className="grid gap-3">
        {matches.map((m) => (
          <Link
            key={m.id}
            href={`/match/${m.id}`}
            className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex justify-between items-center hover:border-yellow-500 transition"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-yellow-500 font-semibold uppercase">{m.sport}</span>
                <span className="text-xs text-gray-600">•</span>
                <span className="text-xs text-gray-400">{formatDate(m.startTime)}</span>
              </div>
              <p className="text-base sm:text-lg font-semibold">
                {m.teamA} <span className="text-gray-500">vs</span> {m.teamB}
              </p>
            </div>
            <span
              className={`text-xs font-bold px-2 py-1 rounded ${
                m.status === "live"
                  ? "bg-green-600 text-white"
                  : m.status === "completed"
                  ? "bg-gray-700 text-gray-400"
                  : "bg-gray-700 text-gray-300"
              }`}
            >
              {statusLabel(m.status)}
            </span>
          </Link>
        ))}
        {matches.length === 0 && <p className="text-gray-500">{t("noMatches")}</p>}
      </div>
    </div>
  );
}
