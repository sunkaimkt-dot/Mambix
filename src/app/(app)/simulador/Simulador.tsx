"use client";
import { useMemo, useState } from "react";
import {
  ALAVANCAS_ZERO,
  simularDFC,
  simularDRE,
  type AjustesGrupo,
  type Alavancas,
  type BaseDFC,
  type BaseDRE,
  type LinhaResultado,
} from "@/lib/simulador-calculo";
import { Cartao } from "@/components/ui";
import { brl, GRUPOS_DRE } from "@/lib/formato";

const ALAVANCAS: { chave: keyof Alavancas; rotulo: string; ajuda: string }[] = [
  { chave: "preco", rotulo: "Preço médio", ajuda: "Faturamento e impostos sobre vendas. O custo da mercadoria não muda." },
  { chave: "quantidade", rotulo: "Quantidade vendida", ajuda: "Faturamento, impostos sobre vendas, CMV e despesas variáveis." },
  { chave: "custoVariavel", rotulo: "Custo variável", ajuda: "CMV e despesas variáveis (81–90)." },
  { chave: "despesaFixa", rotulo: "Despesa fixa", ajuda: "Pró-labore, RH, fixas, demais impostos e financeiras." },
];

/** "5" / "-2,5" -> fracao. Vazio = 0. */
function lerPct(t: string): number {
  const n = Number(t.replace(",", ".").trim());
  return t.trim() === "" || !Number.isFinite(n) ? 0 : n / 100;
}

function variacao(base: number, sim: number) {
  const d = sim - base;
  const p = base !== 0 ? d / Math.abs(base) : null;
  return { d, p };
}

function pctTexto(p: number | null) {
  if (p === null) return "—";
  return `${p > 0 ? "+" : ""}${(p * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function CampoPct({ valor, onChange, rotulo, vazio = "0" }: { valor: string; onChange: (v: string) => void; rotulo: string; vazio?: string }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label={`${rotulo} menos 1 ponto`} onClick={() => onChange(String(Math.round((lerPct(valor) * 100 - 1) * 10) / 10).replace(".", ","))} className="h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">−</button>
      <div className="relative">
        <input
          value={valor}
          inputMode="decimal"
          aria-label={rotulo}
          onChange={(e) => onChange(e.target.value)}
          placeholder={vazio}
          className="h-8 w-20 rounded-lg border border-slate-300 px-2 pr-6 text-right text-sm tabular-nums outline-none focus:border-marca focus:ring-2 focus:ring-marca-clara"
        />
        <span className="pointer-events-none absolute right-2 top-1.5 text-sm text-slate-400">%</span>
      </div>
      <button type="button" aria-label={`${rotulo} mais 1 ponto`} onClick={() => onChange(String(Math.round((lerPct(valor) * 100 + 1) * 10) / 10).replace(".", ","))} className="h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">+</button>
    </div>
  );
}

function Tabela({ linhas, titulo }: { linhas: LinhaResultado[]; titulo: string }) {
  return (
    <Cartao className="overflow-x-auto p-4">
      <p className="mb-3 text-sm font-semibold">{titulo}</p>
      <table className="w-full min-w-[34rem] text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="py-2 text-left font-semibold" />
            <th className="py-2 text-right font-semibold">Base</th>
            <th className="py-2 text-right font-semibold">Simulado</th>
            <th className="py-2 text-right font-semibold">Variação</th>
            <th className="w-16 py-2 text-right font-semibold">%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {linhas.map((l) => {
            const v = variacao(l.base, l.simulado);
            const mudou = Math.round(v.d * 100) !== 0;
            // Para linha de custo (sinal "-"), subir e ruim.
            const bom = l.sinal === "-" ? v.d < 0 : v.d > 0;
            const cor = !mudou ? "text-slate-400" : bom ? "text-positivo" : "text-negativo";
            const destaque = l.nivel === 1;
            return (
              <tr key={l.chave} className={`${destaque ? "bg-slate-50 font-semibold" : ""} ${l.nivel === 2 && !l.base && !l.simulado ? "text-slate-300" : ""}`}>
                <td className={`py-1.5 ${l.nivel === 2 ? "pl-4 text-slate-600" : ""}`}>{l.rotulo}</td>
                <td className="whitespace-nowrap py-1.5 pl-3 text-right tabular-nums">{brl(l.base)}</td>
                <td className="whitespace-nowrap py-1.5 pl-3 text-right tabular-nums">{brl(l.simulado)}</td>
                <td className={`whitespace-nowrap py-1.5 pl-3 text-right tabular-nums ${cor}`}>{mudou ? `${v.d > 0 ? "+" : ""}${brl(v.d)}` : "—"}</td>
                <td className={`whitespace-nowrap py-1.5 pl-3 text-right tabular-nums ${cor}`}>{mudou ? pctTexto(v.p) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Cartao>
  );
}

export default function Simulador({
  baseDRE,
  baseDFC,
  semMargemNoMes,
  lojaEscolhida,
}: {
  baseDRE: BaseDRE;
  baseDFC: BaseDFC;
  semMargemNoMes: boolean;
  lojaEscolhida: boolean;
}) {
  const [aba, setAba] = useState<"dre" | "dfc">("dre");
  const [textos, setTextos] = useState<Record<keyof Alavancas, string>>({ preco: "", quantidade: "", custoVariavel: "", despesaFixa: "" });
  const [grupos, setGrupos] = useState<Record<string, string>>({});
  const [verGrupos, setVerGrupos] = useState(false);

  const alavancas: Alavancas = useMemo(
    () => ({
      ...ALAVANCAS_ZERO,
      preco: lerPct(textos.preco),
      quantidade: lerPct(textos.quantidade),
      custoVariavel: lerPct(textos.custoVariavel),
      despesaFixa: lerPct(textos.despesaFixa),
    }),
    [textos]
  );
  const ajustes: AjustesGrupo = useMemo(() => {
    const a: AjustesGrupo = {};
    for (const [k, v] of Object.entries(grupos)) if (v.trim() !== "") a[k] = lerPct(v);
    return a;
  }, [grupos]);

  const dre = useMemo(() => simularDRE(baseDRE, alavancas, ajustes), [baseDRE, alavancas, ajustes]);
  const dfc = useMemo(() => simularDFC(baseDFC, alavancas), [baseDFC, alavancas]);
  const r = aba === "dre" ? dre.resultado : dfc.resultado;
  const vr = variacao(r.base, r.simulado);
  const algumAjuste = Object.values(textos).some((t) => lerPct(t) !== 0) || Object.keys(ajustes).length > 0;
  const semBase = aba === "dre" ? baseDRE.meses.length === 0 : baseDFC.meses.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm sm:w-fit">
        {(["dre", "dfc"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAba(a)}
            className={`flex-1 rounded-md px-4 py-1.5 sm:flex-none ${aba === a ? "bg-white font-semibold shadow-sm" : "text-slate-500"}`}
          >
            {a === "dre" ? "DRE (competência)" : "Fluxo de caixa (DFC)"}
          </button>
        ))}
      </div>

      {aba === "dre" && semMargemNoMes && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          A margem bruta deste mês não foi informada em Parâmetros: o CMV aparece igual ao faturamento, como na DRE Gerencial.
        </div>
      )}
      {aba === "dfc" && lojaEscolhida && (
        <p className="text-xs text-slate-500">
          Como no DFC, com uma loja escolhida as saídas são da loja e as entradas são da empresa toda.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Cartao className="h-fit p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-sm font-semibold">Alavancas</p>
            {algumAjuste && (
              <button
                type="button"
                onClick={() => { setTextos({ preco: "", quantidade: "", custoVariavel: "", despesaFixa: "" }); setGrupos({}); }}
                className="text-xs text-slate-500 hover:underline"
              >
                zerar tudo
              </button>
            )}
          </div>
          <div className="space-y-4">
            {ALAVANCAS.map((a) => (
              <div key={a.chave}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{a.rotulo}</span>
                  <CampoPct rotulo={a.rotulo} valor={textos[a.chave]} onChange={(v) => setTextos({ ...textos, [a.chave]: v })} />
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">{a.ajuda}</p>
              </div>
            ))}
          </div>

          {aba === "dre" && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setVerGrupos(!verGrupos)} className="text-sm font-medium text-marca hover:underline">
                {verGrupos ? "Esconder" : "Ajustar"} por grupo de despesa
              </button>
              {verGrupos && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] text-slate-400">
                    Preenchido, o % do grupo substitui as alavancas acima naquele grupo inteiro. Em branco, o grupo segue as alavancas.
                  </p>
                  {GRUPOS_DRE.map((g) => (
                    <div key={g.chave} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-600">{g.rotulo}</span>
                      <CampoPct rotulo={g.rotulo} vazio="—" valor={grupos[g.chave] ?? ""} onChange={(v) => setGrupos({ ...grupos, [g.chave]: v })} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Cartao>

        <div className="min-w-0 space-y-6">
          {semBase ? (
            <Cartao className="p-6">
              <p className="text-sm text-slate-500">Não há movimento no período escolhido para montar a base.</p>
            </Cartao>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Cartao className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Resultado base</p>
                  <p className={`text-lg font-bold ${r.base >= 0 ? "text-positivo" : "text-negativo"}`}>{brl(r.base)}</p>
                </Cartao>
                <Cartao className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Resultado simulado</p>
                  <p className={`text-lg font-bold ${r.simulado >= 0 ? "text-positivo" : "text-negativo"}`}>{brl(r.simulado)}</p>
                </Cartao>
                <Cartao className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Diferença no resultado</p>
                  <p className={`text-lg font-bold ${Math.round(vr.d * 100) === 0 ? "text-slate-400" : vr.d > 0 ? "text-positivo" : "text-negativo"}`}>
                    {Math.round(vr.d * 100) === 0 ? "—" : `${vr.d > 0 ? "+" : ""}${brl(vr.d)}`}
                  </p>
                  <p className="text-xs text-slate-400">{Math.round(vr.d * 100) === 0 ? "" : pctTexto(vr.p)}</p>
                </Cartao>
              </div>

              {aba === "dre" ? (
                <>
                  <Tabela titulo="DRE — base x simulada" linhas={dre.linhas} />
                  <p className="text-xs text-slate-500">
                    Margem bruta: {pctTexto(dre.margem.base).replace("+", "")} na base →{" "}
                    {pctTexto(dre.margem.simulado).replace("+", "")} na simulação. Impostos sobre vendas (PIS, COFINS, ISS, ICMS e
                    Simples) acompanham o faturamento. Investimentos, estoque e retirada de sócio não entram na DRE.
                  </p>
                </>
              ) : (
                <>
                  <Tabela titulo="Fluxo de caixa — base x simulado" linhas={dfc.linhas} />
                  <p className="text-xs text-slate-500">
                    As saídas seguem o CFC de cada pagamento: fixas pela alavanca de despesa fixa, variáveis por quantidade e custo
                    variável. Não operacionais e investimentos não mudam. Entradas dos tipos 9 a 12 (receitas financeiras, sócios,
                    empréstimos, outras) também não.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
