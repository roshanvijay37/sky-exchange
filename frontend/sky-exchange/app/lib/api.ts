const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("sky_user");
  if (!stored) return null;
  return JSON.parse(stored).token;
}

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { headers, ...options });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
