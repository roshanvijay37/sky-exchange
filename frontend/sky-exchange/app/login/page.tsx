"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const { login, register } = useAuth();
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (isRegister) {
        await register(username, password);
      } else {
        await login(username, password);
      }
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <div className="flex justify-center mt-20">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-sm">
        <h1 className="text-xl font-bold mb-4">{isRegister ? "Create Account" : "Login"}</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          />
          <button type="submit" className="bg-yellow-500 text-black font-bold py-2 rounded hover:bg-yellow-400 text-sm">
            {isRegister ? "Register" : "Login"}
          </button>
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </form>
        <p className="text-gray-500 text-xs mt-4 text-center">
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <button onClick={() => { setIsRegister(!isRegister); setError(""); }} className="text-yellow-400">
            {isRegister ? "Login" : "Register"}
          </button>
        </p>
      </div>
    </div>
  );
}
