import { supabaseServer } from "@/lib/supabase-server";
import { lerBase } from "@/lib/relatorios-contabeis";
import { montarSerieAno, type SerieAno } from "@/lib/graficos-calculo";

/** Quantos anos a tela Graficos mostra (o escolhido + os anteriores). */
export const ANOS_NO_GRAFICO = 3;

/**
 * Series da tela Graficos: o ano escolhido (ate o mes escolhido) e os dois
 * anteriores, inteiros. Reaproveita lerBase() da Evolucao DRE -- mesma leitura,
 * mesmas regras de loja e de paginacao.
 */
export async function seriesGraficos(
  empresaId: string,
  ano: number,
  mes: number,
  lojaId: string | null
): Promise<SerieAno[]> {
  const supabase = await supabaseServer();
  const anos = Array.from({ length: ANOS_NO_GRAFICO }, (_, i) => ano - (ANOS_NO_GRAFICO - 1) + i);

  const [bases, clientesRes] = await Promise.all([
    Promise.all(anos.map((a) => lerBase(empresaId, a, lojaId))),
    supabase
      .from("parametros_mes")
      .select("ano, mes, clientes")
      .eq("empresa_id", empresaId)
      .gte("ano", anos[0])
      .lte("ano", ano),
  ]);

  const clientesDe = (a: number) => {
    const r: Record<number, number | null> = {};
    for (const p of clientesRes.data ?? []) if (p.ano === a) r[p.mes] = p.clientes ?? null;
    return r;
  };

  return bases.map((b) => montarSerieAno(b, clientesDe(b.ano), b.ano === ano ? mes : 12));
}
