"use client";

import { useEffect, useState } from "react";
import { getConnection } from "../lib/signalr";
import { useAuth } from "../lib/auth";

interface Toast {
  id: number;
  message: string;
  side: string;
}

let toastId = 0;

export default function Toasts() {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (!user) return;

    const conn = getConnection();

    const start = async () => {
      if (conn.state === "Disconnected") await conn.start();
      await conn.invoke("JoinUser", user.id);
    };

    conn.on("TradeNotification", (data: { message: string; side: string }) => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message: data.message, side: data.side }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
    });

    start();

    return () => {
      conn.off("TradeNotification");
    };
  }, [user]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg p-3 text-sm shadow-lg border animate-slide-in ${
            t.side === "back"
              ? "bg-blue-900/90 border-blue-700 text-blue-100"
              : "bg-pink-900/90 border-pink-700 text-pink-100"
          }`}
        >
          <p>✅ {t.message}</p>
        </div>
      ))}
    </div>
  );
}
