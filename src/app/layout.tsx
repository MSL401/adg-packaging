import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Packaging Decoder",
  description: "Plain-English DLA MIL-STD-2073-1 packaging instructions",
};

const NAV = [
  { href: "/", label: "Decode" },
  { href: "/history", label: "Past contracts" },
  { href: "/codes", label: "Code lookup" },
  { href: "/review", label: "Expert review" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="no-print border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="text-lg font-semibold">
              📦 Packaging Decoder
            </Link>
            <nav className="flex gap-4 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-slate-600 hover:text-slate-900">
                  {n.label}
                </Link>
              ))}
            </nav>
            <span className="ml-auto text-xs text-slate-400">MIL-STD-2073-1E Chg 4</span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
