import { brl, MESES_CURTO } from "@/lib/formato";

type SerieGrafico = {
  ano: number;
  meses: number[]; // 12 posicoes, janeiro a dezembro
  titulo?: string; // usado no rotulo de acessibilidade e no texto de "sem valores"
};

/**
 * Evolucao de 12 meses (de um codigo, grupo ou tipo), em SVG puro.
 * Sem biblioteca de grafico de proposito: sao 12 barras, nao compensa carregar
 * 80 kB de JavaScript no cliente para desenhar isso.
 */
export default function GraficoAnual({ serie }: { serie: SerieGrafico }) {
  const { meses } = serie;
  const maximo = Math.max(...meses, 0);
  const mesesComValor = meses.filter((v) => v > 0);
  const total = meses.reduce((s, v) => s + v, 0);
  const media = mesesComValor.length ? total / mesesComValor.length : 0;

  const L = 56;   // margem esquerda (rotulos de valor)
  const R = 8;
  const T = 12;
  const B = 26;   // margem inferior (nomes dos meses)
  const W = 720;
  const H = 260;
  const larguraUtil = W - L - R;
  const alturaUtil = H - T - B;
  const passo = larguraUtil / 12;
  const larguraBarra = passo * 0.62;

  const y = (v: number) => (maximo === 0 ? T + alturaUtil : T + alturaUtil - (v / maximo) * alturaUtil);

  // Tres linhas de referencia bastam para dar noção de escala sem poluir.
  const referencias = maximo === 0 ? [] : [0.5, 1].map((f) => f * maximo);
  const yMedia = media > 0 ? y(media) : null;

  if (total === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-slate-500">
        Nenhum valor lançado{serie.titulo ? ` em ${serie.titulo}` : ""} em {serie.ano}.
      </p>
    );
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
           aria-label={`Evolução mensal${serie.titulo ? ` de ${serie.titulo}` : ""} em ${serie.ano}`}>
        {referencias.map((v, i) => (
          <g key={i}>
            <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}
            </text>
          </g>
        ))}

        <line x1={L} y1={T + alturaUtil} x2={W - R} y2={T + alturaUtil} stroke="#cbd5e1" strokeWidth="1" />

        {yMedia !== null && (
          <>
            <line x1={L} y1={yMedia} x2={W - R} y2={yMedia}
                  stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x={W - R} y={yMedia - 5} textAnchor="end" fontSize="10" fill="#b45309" fontWeight="600">
              média {brl(media)}
            </text>
          </>
        )}

        {meses.map((v, i) => {
          const x = L + i * passo + (passo - larguraBarra) / 2;
          const altura = maximo === 0 ? 0 : (v / maximo) * alturaUtil;
          const acimaDaMedia = media > 0 && v > media;
          return (
            <g key={i}>
              {v > 0 && (
                <>
                  <rect
                    x={x}
                    y={T + alturaUtil - altura}
                    width={larguraBarra}
                    height={altura}
                    rx="3"
                    fill={acimaDaMedia ? "#dc2626" : "#059669"}
                    fillOpacity={acimaDaMedia ? 0.85 : 0.75}
                  />
                  <title>{`${MESES_CURTO[i]}: ${brl(v)}`}</title>
                </>
              )}
              <text
                x={L + i * passo + passo / 2}
                y={H - 8}
                textAnchor="middle"
                fontSize="10"
                fill="#64748b"
              >
                {MESES_CURTO[i]}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Total no ano</p>
          <p className="font-semibold tabular-nums">{brl(total)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Média dos meses com valor</p>
          <p className="font-semibold tabular-nums">{brl(media)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Maior mês</p>
          <p className="font-semibold tabular-nums">
            {brl(maximo)}{" "}
            <span className="text-xs font-normal text-slate-500">
              {MESES_CURTO[meses.indexOf(maximo)]}
            </span>
          </p>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-slate-400">
        Barras em vermelho estão acima da média do ano.
      </p>
    </div>
  );
}
