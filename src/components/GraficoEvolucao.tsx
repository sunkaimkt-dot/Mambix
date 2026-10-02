import { brl, MESES_CURTO } from "@/lib/formato";

/**
 * Grafico anual da Evolucao DRE / DFC, em SVG puro (mesmo padrao do
 * GraficoAnual.tsx): duas barras por mes (faturamento x despesas, ou
 * entradas x saidas) e a linha do resultado. Uma escala so, em R$ -- o
 * resultado pode ser negativo, entao o eixo desce abaixo de zero quando precisa.
 */
export default function GraficoEvolucao({
  ano,
  a,
  b,
  resultado,
  rotuloA,
  rotuloB,
}: {
  ano: number;
  a: number[];
  b: number[];
  resultado: number[];
  rotuloA: string;
  rotuloB: string;
}) {
  const todos = [...a, ...b, ...resultado];
  if (todos.every((v) => v === 0)) {
    return <p className="px-4 py-10 text-center text-sm text-slate-500">Nenhum valor lançado em {ano}.</p>;
  }
  const maximo = Math.max(...todos, 0);
  const minimo = Math.min(...todos, 0);

  const L = 56, R = 8, T = 12, B = 26, W = 760, H = 270;
  const alt = H - T - B;
  const passo = (W - L - R) / 12;
  const larg = passo * 0.32;
  const y = (v: number) => T + ((maximo - v) / (maximo - minimo || 1)) * alt;
  const y0 = y(0);
  const fmt = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`);
  const refs = [maximo, maximo / 2, minimo < 0 ? minimo : null].filter((v): v is number => v !== null && v !== 0);

  // Mes sem nenhum movimento (ex.: meses que ainda nao chegaram) nao ganha
  // ponto de resultado -- um "zero" ali pareceria um mes ruim.
  const comMovimento = resultado.map((v, i) => v !== 0 || a[i] !== 0 || b[i] !== 0);
  const pontos = resultado
    .map((v, i) => (comMovimento[i] ? `${L + i * passo + passo / 2},${y(v)}` : null))
    .filter(Boolean)
    .join(" ");

  return (
    <div className="avoid-break">
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--marca)" }} />{rotuloA}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-400" />{rotuloB}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-slate-800" />Resultado</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${rotuloA}, ${rotuloB} e resultado por mês em ${ano}`}>
        {refs.map((v, i) => (
          <g key={i}>
            <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{fmt(v)}</text>
          </g>
        ))}
        <line x1={L} y1={y0} x2={W - R} y2={y0} stroke="#94a3b8" strokeWidth="1" />
        <text x={L - 6} y={y0 + 4} textAnchor="end" fontSize="10" fill="#94a3b8">0</text>

        {MESES_CURTO.map((m, i) => {
          const x = L + i * passo + passo / 2;
          const barra = (v: number, dx: number, fill: string, rotulo: string) =>
            v !== 0 && (
              <rect x={x + dx} y={Math.min(y(v), y0)} width={larg} height={Math.max(Math.abs(y(v) - y0), 1)} rx="2" fill={fill}>
                <title>{`${m}: ${rotulo} ${brl(v)}`}</title>
              </rect>
            );
          return (
            <g key={m}>
              {barra(a[i], -larg - 1, "var(--marca)", rotuloA)}
              {barra(b[i], 1, "#94a3b8", rotuloB)}
              <text x={x} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b">{m}</text>
            </g>
          );
        })}

        <polyline points={pontos} fill="none" stroke="#1e293b" strokeWidth="2" />
        {resultado.map((v, i) => comMovimento[i] && (
          <circle key={i} cx={L + i * passo + passo / 2} cy={y(v)} r="4" fill={v >= 0 ? "#047857" : "#dc2626"} stroke="white" strokeWidth="2">
            <title>{`${MESES_CURTO[i]}: resultado ${brl(v)}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
