import { brl, MESES_CURTO } from "@/lib/formato";

/*
 * Graficos da tela Graficos (5.9). SVG puro renderizado no servidor, mesmo
 * padrao do GraficosPainel.tsx.
 *
 * Cor segue o ANO, nunca a posicao: o ano escolhido e sempre a cor da marca e
 * os anteriores sao cinzas cada vez mais claros. Assim o olho vai direto para o
 * ano que importa, e os outros ficam de referencia. Toda serie tem legenda e o
 * valor exato aparece no tooltip (<title>) e na tabela abaixo dos graficos.
 * Um eixo so -- valores negativos (prejuizo) descem abaixo da linha do zero.
 */

const CINZAS = ["#64748b", "#94a3b8", "#cbd5e1"];
const GRADE = "#e2e8f0";
const EIXO = "#94a3b8";
const TEXTO = "#64748b";

export type Serie = { rotulo: string; valores: (number | null)[]; destaque?: boolean };

function abreviar(v: number) {
  const a = Math.abs(v);
  const s = v < 0 ? "-" : "";
  if (a >= 1_000_000) return `${s}${(a / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (a >= 10_000) return `${s}${Math.round(a / 1000)}k`;
  if (a >= 1000) return `${s}${(a / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return `${s}${Math.round(a)}`;
}

function topoRedondo(v: number) {
  if (v <= 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Cor por serie: destaque = cor da marca; as demais vem em ordem cronologica
    e clareiam conforme se afastam -- o ano mais recente e o cinza mais escuro. */
function cores(series: Serie[]) {
  const out = series.map(() => "");
  let i = 0;
  for (let j = series.length - 1; j >= 0; j--) {
    out[j] = series[j].destaque ? "var(--marca)" : CINZAS[Math.min(i++, CINZAS.length - 1)];
  }
  return out;
}

/** Linhas de grade: topo, meio, zero e fundo -- o "meio do negativo" so entra
    quando a parte negativa e grande, senao os rotulos se sobrepoem. */
function grade(max: number, min: number) {
  const v = [max, max / 2, 0];
  if (min < 0) {
    if (-min >= max * 0.5) v.push(min / 2);
    v.push(min);
  }
  return v.filter((x, i, a) => a.indexOf(x) === i);
}

function Legenda({ series, cor }: { series: Serie[]; cor: string[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
      {series.map((s, i) => (
        <span key={s.rotulo} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: cor[i] }} />
          {s.rotulo}
        </span>
      ))}
    </div>
  );
}

/** Escala com zero dentro: comporta prejuizo sem um segundo eixo. */
function escala(series: Serie[], H: number, T: number, B: number) {
  const todos = series.flatMap((s) => s.valores.filter((v): v is number => v !== null));
  const max = topoRedondo(Math.max(0, ...todos));
  const min = -topoRedondo(Math.max(0, ...todos.map((v) => -v)));
  const util = H - T - B;
  const faixa = max - min || 1;
  const y = (v: number) => T + ((max - v) / faixa) * util;
  return { max, min, y, vazio: todos.length === 0 || (max === 0 && min === 0) };
}

/** Barra presa no zero, com 3px de arredondamento na ponta de dados. */
function barra(x: number, y0: number, w: number, y1: number) {
  const h = Math.abs(y1 - y0);
  if (h < 0.5) return "";
  const r = Math.min(3, w / 2, h);
  if (y1 < y0) {
    return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
  }
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
}

/** Colunas mes a mes, uma barra por serie (ano). */
export function ColunasPorMes({
  series,
  vazio = "Sem dados no período.",
  formato = brl,
}: {
  series: Serie[];
  vazio?: string;
  formato?: (v: number | null) => string;
}) {
  const W = 720, H = 250, L = 52, R = 8, T = 10, B = 24;
  const e = escala(series, H, T, B);
  if (e.vazio) return <p className="py-10 text-center text-sm text-slate-500">{vazio}</p>;
  const cor = cores(series);
  const passo = (W - L - R) / 12;
  const gap = 2;
  const wBarra = Math.min(18, (passo * 0.78 - gap * (series.length - 1)) / series.length);
  const grupo = wBarra * series.length + gap * (series.length - 1);
  const y0 = e.y(0);
  const linhas = grade(e.max, e.min);

  return (
    <div>
      {series.length > 1 && <Legenda series={series} cor={cor} />}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Colunas mês a mês">
        {linhas.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={e.y(v)} y2={e.y(v)} stroke={v === 0 ? EIXO : GRADE} />
            <text x={L - 6} y={e.y(v) + 4} textAnchor="end" fontSize="10" fill={TEXTO}>{abreviar(v)}</text>
          </g>
        ))}
        {MESES_CURTO.map((m, i) => {
          const x0 = L + i * passo + (passo - grupo) / 2;
          return (
            <g key={m}>
              {series.map((s, j) => {
                const v = s.valores[i];
                if (v === null) return null;
                return <path key={s.rotulo} d={barra(x0 + j * (wBarra + gap), y0, wBarra, e.y(v))} fill={cor[j]} />;
              })}
              <text x={L + i * passo + passo / 2} y={H - 8} textAnchor="middle" fontSize="10" fill={TEXTO}>{m}</text>
              <rect x={L + i * passo} y={T} width={passo} height={H - T - B} fill="transparent">
                <title>{`${m}\n${series.map((s) => `${s.rotulo}: ${s.valores[i] === null ? "—" : formato(s.valores[i])}`).join("\n")}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Linhas de 12 meses, uma por ano -- para enxergar sazonalidade entre anos. */
export function LinhasPorAno({ series, vazio = "Sem dados no período." }: { series: Serie[]; vazio?: string }) {
  const W = 720, H = 230, L = 52, R = 8, T = 10, B = 24;
  const e = escala(series, H, T, B);
  if (e.vazio) return <p className="py-10 text-center text-sm text-slate-500">{vazio}</p>;
  const cor = cores(series);
  const passo = (W - L - R) / 12;
  const x = (i: number) => L + i * passo + passo / 2;
  const linhas = grade(e.max, e.min);

  // Quebra a linha onde falta valor, em vez de ligar por cima do buraco.
  const caminho = (vs: (number | null)[]) => {
    let d = "";
    let caneta = false;
    vs.forEach((v, i) => {
      if (v === null) { caneta = false; return; }
      d += `${caneta ? "L" : "M"}${x(i)},${e.y(v)}`;
      caneta = true;
    });
    return d;
  };

  // Desenha o destaque por ultimo, para ficar por cima.
  const ordem = series.map((s, i) => i).sort((a, b) => Number(!!series[a].destaque) - Number(!!series[b].destaque));

  return (
    <div>
      {series.length > 1 && <Legenda series={series} cor={cor} />}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Linhas por ano">
        {linhas.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={e.y(v)} y2={e.y(v)} stroke={v === 0 ? EIXO : GRADE} />
            <text x={L - 6} y={e.y(v) + 4} textAnchor="end" fontSize="10" fill={TEXTO}>{abreviar(v)}</text>
          </g>
        ))}
        {ordem.map((j) => {
          const s = series[j];
          return (
            <g key={s.rotulo}>
              <path d={caminho(s.valores)} fill="none" stroke={cor[j]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {s.valores.map((v, i) =>
                v === null ? null : (
                  <circle key={i} cx={x(i)} cy={e.y(v)} r={s.destaque ? 4 : 3} fill={cor[j]} stroke="#fff" strokeWidth={2} />
                )
              )}
            </g>
          );
        })}
        {MESES_CURTO.map((m, i) => (
          <g key={m}>
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill={TEXTO}>{m}</text>
            <rect x={L + i * passo} y={T} width={passo} height={H - T - B} fill="transparent">
              <title>{`${m}\n${series.map((s) => `${s.rotulo}: ${s.valores[i] === null ? "—" : brl(s.valores[i])}`).join("\n")}`}</title>
            </rect>
          </g>
        ))}
      </svg>
    </div>
  );
}
