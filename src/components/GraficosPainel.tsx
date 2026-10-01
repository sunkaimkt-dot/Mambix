import { brl, MESES_CURTO } from "@/lib/formato";

/*
 * Graficos do Painel e dos relatorios diarios, em SVG puro -- mesmo padrao do
 * GraficoAnual.tsx (sem biblioteca, renderizados no servidor).
 *
 * Cores: as mesmas do resto do sistema (verde = entrada/positivo, vermelho =
 * saida/negativo). O par passou no validador de daltonismo; mesmo assim toda
 * serie tem legenda e o valor exato aparece no tooltip (<title>) e nas tabelas.
 * O tooltip fica num retangulo invisivel do tamanho da coluna inteira, para o
 * mouse nao precisar acertar uma barra fina.
 */

const VERDE = "#059669";
const VERMELHO = "#dc2626";
const NEUTRO = "#94a3b8";
const GRADE = "#e2e8f0";
const EIXO = "#cbd5e1";
const TEXTO = "#64748b";

/** 1234567 -> "1,2 mi"; 15300 -> "15k"; usado so nos rotulos do eixo. */
function abreviar(v: number) {
  const a = Math.abs(v);
  const s = v < 0 ? "-" : "";
  if (a >= 1_000_000) return `${s}${(a / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (a >= 1000) return `${s}${Math.round(a / 1000)}k`;
  return `${s}${Math.round(a)}`;
}

/** Topo da escala "redondo" para as linhas de grade nao cairem em 37.412. */
function topoRedondo(v: number) {
  if (v <= 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Barra com o topo arredondado e a base reta, presa na linha de base. */
function barra(x: number, yBase: number, w: number, h: number, paraCima: boolean, r = 3) {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  if (paraCima) {
    const yt = yBase - h;
    return `M${x},${yBase}V${yt + rr}Q${x},${yt} ${x + rr},${yt}H${x + w - rr}Q${x + w},${yt} ${x + w},${yt + rr}V${yBase}Z`;
  }
  const yb = yBase + h;
  return `M${x},${yBase}V${yb - rr}Q${x},${yb} ${x + rr},${yb}H${x + w - rr}Q${x + w},${yb} ${x + w},${yb - rr}V${yBase}Z`;
}

function Legenda({ itens }: { itens: { cor: string; rotulo: string; tracejado?: boolean }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
      {itens.map((i) => (
        <span key={i.rotulo} className="inline-flex items-center gap-1.5">
          {i.tracejado ? (
            <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: i.cor }} />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.cor }} />
          )}
          {i.rotulo}
        </span>
      ))}
    </div>
  );
}

const rotuloMes = (p: { ano: number; mes: number }, i: number) =>
  i === 0 || p.mes === 1 ? `${MESES_CURTO[p.mes - 1]}/${String(p.ano).slice(2)}` : MESES_CURTO[p.mes - 1];

/* ------------------------------------------------------------------ */

type PontoCaixa = { ano: number; mes: number; entradas: number; saidas: number };

/** Entradas x Saidas, 12 meses, barras agrupadas. */
export function GraficoEntradasSaidas({ pontos }: { pontos: PontoCaixa[] }) {
  const W = 720, H = 240, L = 48, R = 8, T = 10, B = 24;
  const alturaUtil = H - T - B;
  const topo = topoRedondo(Math.max(0, ...pontos.flatMap((p) => [p.entradas, p.saidas])));
  if (topo === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">Nenhuma entrada ou saída de caixa nos últimos 12 meses.</p>;
  }
  const passo = (W - L - R) / pontos.length;
  const wBarra = passo * 0.32;
  const gap = 2;
  const yBase = T + alturaUtil;
  const h = (v: number) => (v / topo) * alturaUtil;

  return (
    <div>
      <Legenda itens={[{ cor: VERDE, rotulo: "Entradas" }, { cor: VERMELHO, rotulo: "Saídas" }]} />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Entradas e saídas de caixa nos últimos 12 meses">
        {[0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={yBase - f * alturaUtil} y2={yBase - f * alturaUtil} stroke={GRADE} />
            <text x={L - 6} y={yBase - f * alturaUtil + 4} textAnchor="end" fontSize="10" fill={NEUTRO}>{abreviar(topo * f)}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={yBase} y2={yBase} stroke={EIXO} />
        {pontos.map((p, i) => {
          const cx = L + i * passo + passo / 2;
          const res = p.entradas - p.saidas;
          return (
            <g key={`${p.ano}-${p.mes}`}>
              <path d={barra(cx - gap / 2 - wBarra, yBase, wBarra, h(p.entradas), true)} fill={VERDE} />
              <path d={barra(cx + gap / 2, yBase, wBarra, h(p.saidas), true)} fill={VERMELHO} />
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill={TEXTO}>{rotuloMes(p, i)}</text>
              <rect x={L + i * passo} y={T} width={passo} height={alturaUtil} fill="transparent">
                <title>{`${MESES_CURTO[p.mes - 1]}/${p.ano}\nEntradas: ${brl(p.entradas)}\nSaídas: ${brl(p.saidas)}\nResultado: ${brl(res)}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type PontoResultado = { ano: number; mes: number; faturamento: number; despesas: number; margem: number | null; resultado: number | null };

/** Resultado mensal (competencia): barra verde acima do zero, vermelha abaixo. */
export function GraficoResultado({ pontos }: { pontos: PontoResultado[] }) {
  const W = 720, H = 240, L = 48, R = 8, T = 12, B = 24;
  const valores = pontos.map((p) => p.resultado ?? 0);
  const maxPos = topoRedondo(Math.max(0, ...valores));
  const maxNeg = topoRedondo(Math.max(0, ...valores.map((v) => -v)));
  const amplitude = maxPos + maxNeg;
  const semMargem = pontos.filter((p) => p.resultado === null).length;

  if (amplitude === 0 && semMargem === pontos.length) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        Nenhum mês com margem bruta informada em Parâmetros do mês — sem ela não dá para calcular o resultado.
      </p>
    );
  }

  const alturaUtil = H - T - B;
  const escala = amplitude === 0 ? 0 : alturaUtil / amplitude;
  const yZero = amplitude === 0 ? T + alturaUtil / 2 : T + maxPos * escala;
  const passo = (W - L - R) / pontos.length;
  const wBarra = passo * 0.55;

  return (
    <div>
      <Legenda itens={[{ cor: VERDE, rotulo: "Lucro" }, { cor: VERMELHO, rotulo: "Prejuízo" }]} />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Resultado mensal por competência nos últimos 12 meses">
        {maxPos > 0 && (
          <g>
            <line x1={L} x2={W - R} y1={T} y2={T} stroke={GRADE} />
            <text x={L - 6} y={T + 4} textAnchor="end" fontSize="10" fill={NEUTRO}>{abreviar(maxPos)}</text>
          </g>
        )}
        {maxNeg > 0 && (
          <g>
            <line x1={L} x2={W - R} y1={T + alturaUtil} y2={T + alturaUtil} stroke={GRADE} />
            <text x={L - 6} y={T + alturaUtil + 4} textAnchor="end" fontSize="10" fill={NEUTRO}>{abreviar(-maxNeg)}</text>
          </g>
        )}
        <line x1={L} x2={W - R} y1={yZero} y2={yZero} stroke={EIXO} />
        <text x={L - 6} y={yZero + 4} textAnchor="end" fontSize="10" fill={NEUTRO}>0</text>
        {pontos.map((p, i) => {
          const x = L + i * passo + (passo - wBarra) / 2;
          const v = p.resultado;
          const dica =
            v === null
              ? `${MESES_CURTO[p.mes - 1]}/${p.ano}\nSem margem bruta em Parâmetros do mês\nFaturamento: ${brl(p.faturamento)}\nDespesas: ${brl(p.despesas)}`
              : `${MESES_CURTO[p.mes - 1]}/${p.ano}\nResultado: ${brl(v)}\nFaturamento: ${brl(p.faturamento)}\nMargem: ${(p.margem! * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%\nDespesas: ${brl(p.despesas)}`;
          return (
            <g key={`${p.ano}-${p.mes}`}>
              {v === null ? (
                <text x={x + wBarra / 2} y={yZero - 6} textAnchor="middle" fontSize="9" fill={NEUTRO}>s/ margem</text>
              ) : (
                <path d={barra(x, yZero, wBarra, Math.abs(v) * escala, v >= 0)} fill={v >= 0 ? VERDE : VERMELHO} />
              )}
              <text x={x + wBarra / 2} y={H - 8} textAnchor="middle" fontSize="10" fill={TEXTO}>{rotuloMes(p, i)}</text>
              <rect x={L + i * passo} y={T} width={passo} height={alturaUtil} fill="transparent">
                <title>{dica}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      {semMargem > 0 && (
        <p className="mt-1 text-[11px] text-slate-400">
          “s/ margem”: mês sem margem bruta em Parâmetros do mês. Sem ela o resultado não é calculado, para não mostrar um prejuízo que não existe.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export type ItemBarra = { rotulo: string; valor: number; detalhe?: string; cor?: string };

/** Barras horizontais com o valor escrito ao lado (grupos de despesa, contas a pagar). */
export function BarrasHorizontais({ itens, vazio, corPadrao = "var(--marca)" }: { itens: ItemBarra[]; vazio: string; corPadrao?: string }) {
  const max = Math.max(0, ...itens.map((i) => i.valor));
  if (max === 0) return <p className="py-8 text-center text-sm text-slate-500">{vazio}</p>;
  return (
    <ul className="space-y-2.5">
      {itens.map((i) => (
        <li key={i.rotulo} title={`${i.rotulo}: ${brl(i.valor)}${i.detalhe ? ` — ${i.detalhe}` : ""}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-slate-700">{i.rotulo}</span>
            <span className="shrink-0 font-medium tabular-nums text-slate-900">
              {brl(i.valor)}
              {i.detalhe && <span className="ml-1.5 text-xs font-normal text-slate-500">{i.detalhe}</span>}
            </span>
          </div>
          <div className="h-2 rounded bg-slate-100">
            <div
              className="h-2 rounded"
              style={{ width: `${(i.valor / max) * 100}%`, minWidth: i.valor > 0 ? 4 : 0, background: i.cor ?? corPadrao }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */

const SEMANA_CURTA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/**
 * Barras dia a dia de um mes (faturamento diario). Opcionalmente desenha o mes
 * anterior como uma linha tracejada cinza, so de referencia.
 */
export function GraficoDiario({
  valores,
  diasSemana,
  anteriores,
  rotuloSerie,
  rotuloAnterior,
  vazio,
}: {
  valores: number[]; // indice 0 = dia 1
  diasSemana: number[];
  anteriores?: (number | null)[];
  rotuloSerie: string;
  rotuloAnterior?: string;
  vazio: string;
}) {
  const W = 760, H = 230, L = 48, R = 8, T = 10, B = 30;
  const alturaUtil = H - T - B;
  const topo = topoRedondo(Math.max(0, ...valores, ...(anteriores ?? []).map((v) => v ?? 0)));
  if (topo === 0) return <p className="py-10 text-center text-sm text-slate-500">{vazio}</p>;
  const n = valores.length;
  const passo = (W - L - R) / n;
  const wBarra = Math.max(2, passo - 2);
  const yBase = T + alturaUtil;
  const y = (v: number) => yBase - (v / topo) * alturaUtil;

  const pontosAnt = (anteriores ?? [])
    .map((v, i) => (v === null ? null : `${L + i * passo + passo / 2},${y(v)}`))
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <Legenda
        itens={[
          { cor: VERDE, rotulo: rotuloSerie },
          ...(anteriores && rotuloAnterior ? [{ cor: NEUTRO, rotulo: rotuloAnterior, tracejado: true }] : []),
        ]}
      />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={rotuloSerie}>
        {[0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(topo * f)} y2={y(topo * f)} stroke={GRADE} />
            <text x={L - 6} y={y(topo * f) + 4} textAnchor="end" fontSize="10" fill={NEUTRO}>{abreviar(topo * f)}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={yBase} y2={yBase} stroke={EIXO} />
        {valores.map((v, i) => {
          const x = L + i * passo + (passo - wBarra) / 2;
          const fimDeSemana = diasSemana[i] === 0 || diasSemana[i] === 6;
          return (
            <g key={i}>
              <path d={barra(x, yBase, wBarra, (v / topo) * alturaUtil, true, 2)} fill={VERDE} fillOpacity={fimDeSemana ? 0.55 : 0.9} />
              <text x={L + i * passo + passo / 2} y={H - 16} textAnchor="middle" fontSize="9" fill={TEXTO}>{i + 1}</text>
              <text x={L + i * passo + passo / 2} y={H - 5} textAnchor="middle" fontSize="7.5" fill={NEUTRO}>{SEMANA_CURTA[diasSemana[i]].slice(0, 1)}</text>
            </g>
          );
        })}
        {pontosAnt && <polyline points={pontosAnt} fill="none" stroke={NEUTRO} strokeWidth="1.5" strokeDasharray="4 3" />}
        {valores.map((v, i) => {
          const ant = anteriores?.[i];
          return (
            <rect key={`h${i}`} x={L + i * passo} y={T} width={passo} height={alturaUtil} fill="transparent">
              <title>{`Dia ${i + 1} (${SEMANA_CURTA[diasSemana[i]]})\n${rotuloSerie}: ${brl(v)}${
                anteriores && rotuloAnterior ? `\n${rotuloAnterior}: ${ant === null || ant === undefined ? "—" : brl(ant)}` : ""
              }`}</title>
            </rect>
          );
        })}
      </svg>
      <p className="mt-1 text-[11px] text-slate-400">Barras mais claras: sábado e domingo.</p>
    </div>
  );
}

export { SEMANA_CURTA };
