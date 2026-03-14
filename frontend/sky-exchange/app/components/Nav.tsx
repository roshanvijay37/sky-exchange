import Link from "next/link";

export default function Nav() {
  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-6">
      <Link href="/" className="text-xl font-bold text-yellow-400">⚡ Sky Exchange</Link>
      <Link href="/" className="text-gray-300 hover:text-white text-sm">Matches</Link>
      <Link href="/positions" className="text-gray-300 hover:text-white text-sm">My Positions</Link>
    </nav>
  );
}
