"use client";
import { alternarPago } from "@/lib/acoes";
import { useTransition } from "react";

export default function InterruptorPago({ id, pago }: { id: string; pago: boolean }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => iniciar(() => void alternarPago(id, !pago))}
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        pago ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"
      } disabled:opacity-50`}
    >
      {pago ? "Pago" : "Em aberto"}
    </button>
  );
}
