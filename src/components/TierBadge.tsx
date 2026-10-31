import type { Tier } from "@/lib/decoder/types";

const STYLE: Record<Tier, { cls: string; icon: string; text: string }> = {
  red: { cls: "bg-red-100 text-red-800 ring-red-300", icon: "🔴", text: "Star / special" },
  yellow: { cls: "bg-amber-100 text-amber-800 ring-amber-300", icon: "🟡", text: "Purchase needed" },
  green: { cls: "bg-emerald-100 text-emerald-800 ring-emerald-300", icon: "🟢", text: "Basic" },
};

export function TierBadge({ tier, review }: { tier: Tier; review?: boolean }) {
  const s = STYLE[tier];
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${s.cls}`}>
        {s.icon} {s.text}
      </span>
      {review && (
        <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-300" title="Has a special (ZZ) field or referenced document">
          ⚠️ check
        </span>
      )}
    </span>
  );
}
