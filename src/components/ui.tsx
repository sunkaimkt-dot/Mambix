export const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca-clara";

export function Campo({
  rotulo,
  children,
  className = "",
}: {
  rotulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{rotulo}</span>
      {children}
    </label>
  );
}

/* `tour`: ancora do tour guiado (data-tour). Ver src/lib/tours.ts. */
export function Cartao({ children, className = "", tour }: { children: React.ReactNode; className?: string; tour?: string }) {
  return (
    <div data-tour={tour} className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      {children}
    </div>
  );
}

export function Vazio({ texto }: { texto: string }) {
  return <p className="px-4 py-8 text-center text-sm text-slate-500">{texto}</p>;
}
