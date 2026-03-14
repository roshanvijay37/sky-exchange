"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchApi } from "./lib/api";
import { Match } from "./lib/types";

export default function Home() {
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    fetchApi<Match[]>("/matches").then(setMatches);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Live & Upcoming Matches</h1>
      <div className="grid gap-3">
        {matches.map((m) => (
          <Link
            key={m.id}
            href={`/match/${m.id}`}
            className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex justify-between items-center hover:border-yellow-500 transition"
          >
            <div>
              <span className="text-xs text-gray-400 uppercase">{m.sport}</span>
              <p className="text-lg font-semibold">
                {m.teamA} <span className="text-gray-500">vs</span> {m.teamB}
              </p>
            </div>
            <span
              className={`text-xs font-bold px-2 py-1 rounded ${
                m.status === "live"
                  ? "bg-green-600 text-white"
                  : "bg-gray-700 text-gray-300"
              }`}
            >
              {m.status.toUpperCase()}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
