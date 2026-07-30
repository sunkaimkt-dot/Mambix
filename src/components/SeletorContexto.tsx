"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { MESES } from "@/lib/formato";

type Props = {
  empresas: { id: string; nome: string }[];
  empresaId: string;
  lojas: { id: string; nome: string }[];
  lojaId: string | null;
  mes: number;
  ano: number;
};

export default function SeletorContexto({ empresas, empresaId, lojas, lojaId, mes, ano }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function troca(chave: string, valor: string) {
    const p = new URLSearchParams(sp.toString());
    p.set(chave, valor);
    router.push(`${pathname}?${p.toString()}`);
  }

  const anos = [ano - 2, ano - 1, ano, ano + 1];
  const base =
    "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={base} value={empresaId} onChange={(e) => troca("empresa", e.target.value)}>
        {empresas.map((e) => (
          <option key={e.id} value={e.id}>{e.nome}</option>
        ))}
      </select>

      <select className={base} value={lojaId ?? "todas"} onChange={(e) => troca("loja", e.target.value)}>
        <option value="todas">Todas as lojas</option>
        {lojas.map((l) => (
          <option key={l.id} value={l.id}>{l.nome}</option>
        ))}
      </select>

      <select className={base} value={mes} onChange={(e) => troca("mes", e.target.value)}>
        {MESES.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>

      <select className={base} value={ano} onChange={(e) => troca("ano", e.target.value)}>
        {anos.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
    </div>
  );
}
