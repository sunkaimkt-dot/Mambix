/**
 * Simulador de cenarios (Combo 3) -- leitura da base.
 *
 * Usa dadosDRE / dadosDFC do relatorios.ts (so importa, nao edita): a base do
 * simulador e exatamente o que a DRE Gerencial e o DFC mostram para cada mes,
 * inclusive no comportamento do filtro de loja (o DFC atual nao filtra as
 * receitas por loja -- ponto em aberto com o Marcelo, mantido como esta).
 */
import { dadosDRE, dadosDFC } from "@/lib/relatorios";
import { montarBaseDFC, montarBaseDRE, mesesAte, type BaseDFC, type BaseDRE } from "@/lib/simulador-calculo";

export const PERIODOS_BASE = [1, 3, 6, 12] as const;

export async function carregarBaseSimulador(
  empresaId: string,
  ano: number,
  mes: number,
  nMeses: number,
  lojaId: string | null
): Promise<{ dre: BaseDRE; dfc: BaseDFC }> {
  const meses = mesesAte(ano, mes, nMeses);
  const [dres, dfcs] = await Promise.all([
    Promise.all(meses.map((m) => dadosDRE(empresaId, m.ano, m.mes, lojaId))),
    Promise.all(meses.map((m) => dadosDFC(empresaId, m.ano, m.mes, lojaId))),
  ]);
  return {
    dre: montarBaseDRE(
      dres.map((d, i) => ({
        ...meses[i],
        faturamento: d.faturamento,
        porTipoVenda: d.porTipoVenda,
        porCodigo: d.porCodigo,
        cmv: d.cmv,
        margem: d.margem,
      }))
    ),
    dfc: montarBaseDFC(
      dfcs.map((d, i) => ({
        ...meses[i],
        entradas: d.entradas,
        porTipoRecebimento: d.porTipoRecebimento,
        porCFC: d.porCFC,
        saidas: d.saidas,
      }))
    ),
  };
}
