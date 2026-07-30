import { Suspense } from "react";
import SeletorContexto from "@/components/SeletorContexto";
import type { Contexto } from "@/lib/contexto";

export default function Cabecalho({ titulo, subtitulo, ctx }: { titulo: string; subtitulo?: string; ctx: Contexto }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{titulo}</h1>
        {subtitulo && <p className="text-sm text-slate-500">{subtitulo}</p>}
      </div>
      <Suspense fallback={null}>
        <SeletorContexto
          empresas={ctx.empresas}
          empresaId={ctx.empresaId}
          lojas={ctx.lojas}
          lojaId={ctx.lojaId}
          mes={ctx.mes}
          ano={ctx.ano}
        />
      </Suspense>
    </header>
  );
}
