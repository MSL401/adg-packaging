"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="ml-auto rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white">
      🖨️ Print
    </button>
  );
}
