"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { aceitarConvite } from "@/lib/acoes";

export default function AceitarConvite({ token }: { token: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);

  return (
    <div>
      <button
        disabled={indo}
        onClick={async () => {
          setErro(null);
          setIndo(true);
          const r = await aceitarConvite(token);
          if (r.ok) router.push("/dashboard");
          else {
            setErro(r.erro ?? "Não foi possível aceitar o convite.");
            setIndo(false);
          }
        }}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {indo ? "Aceitando…" : "Aceitar convite"}
      </button>
      {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
    </div>
  );
}
