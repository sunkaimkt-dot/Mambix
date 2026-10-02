"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CAMPOS,
  ROTULO_TIPO,
  csvRejeitadas,
  decodificarTexto,
  escolherParaGravar,
  formatarDataBR,
  lerCSV,
  mapearAutomatico,
  marcarDuplicados,
  normalizar,
  periodoDasLinhas,
  separarCabecalho,
  textoCelula,
  validarLinhas,
  valorDaLinha,
  type Celula,
  type LinhaValidada,
  type Mapeamento,
  type Planilha,
  type Referencias,
  type TipoImportacao,
} from "@/lib/importacao";
import { buscarExistentes, criarLote, finalizarLote, gravarLinhas, type ResultadoLinha } from "@/lib/importacao-acoes";
import { Campo, Cartao, inputCls } from "@/components/ui";
import { brl } from "@/lib/formato";

const PEDACO = 25;
const TIPOS: TipoImportacao[] = ["pagamentos", "receitas", "caixa_diario"];
const MODELO = "/modelos/modelo-importacao-nortex.xlsx";

type Aba = { nome: string; dados: Celula[][] };
type Rejeitada = { numero: number; original: Celula[]; motivo: string };
type Resumo = { importadas: number; valor: number; rejeitadas: Rejeitada[]; avisos: string[] };

const SITUACAO: Record<LinhaValidada["situacao"], { rotulo: string; cls: string }> = {
  ok: { rotulo: "ok", cls: "bg-emerald-50 text-emerald-700" },
  duplicado: { rotulo: "duplicado", cls: "bg-amber-50 text-amber-700" },
  conflito: { rotulo: "dia já lançado", cls: "bg-amber-50 text-amber-700" },
  erro: { rotulo: "erro", cls: "bg-red-50 text-red-700" },
};

async function lerArquivo(arquivo: File): Promise<Aba[]> {
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith(".xlsx")) {
    // Carregada so aqui: a biblioteca nao pesa nas outras telas.
    const { default: lerExcel } = await import("read-excel-file/browser");
    const abas = await lerExcel(arquivo);
    return abas.map((a) => ({ nome: a.sheet, dados: a.data as Celula[][] }));
  }
  if (nome.endsWith(".csv") || nome.endsWith(".txt")) {
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    return [{ nome: arquivo.name, dados: lerCSV(decodificarTexto(bytes)) }];
  }
  if (nome.endsWith(".xls")) throw new Error("Arquivo .xls (Excel antigo) não é lido. No Excel, use Salvar como → Pasta de Trabalho do Excel (.xlsx).");
  if (nome.endsWith(".pdf")) throw new Error("PDF ainda não é importado — por enquanto só Excel (.xlsx) e CSV.");
  throw new Error("Formato não reconhecido. Use .xlsx ou .csv.");
}

function abaDoTipo(abas: Aba[], tipo: TipoImportacao) {
  const chave = { pagamentos: "pagamento", receitas: "receita", caixa_diario: "caixa" }[tipo];
  const i = abas.findIndex((a) => normalizar(a.nome).includes(chave));
  return i >= 0 ? i : 0;
}

export default function Importador({
  empresaId,
  lojas,
  lojaPadrao,
  referencias,
}: {
  empresaId: string;
  lojas: { id: string; nome: string }[];
  lojaPadrao: string;
  referencias: Referencias;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoImportacao>("pagamentos");
  const [lojaId, setLojaId] = useState(lojaPadrao);
  const [bancoId, setBancoId] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [abas, setAbas] = useState<Aba[]>([]);
  const [abaIdx, setAbaIdx] = useState(0);
  const [mapa, setMapa] = useState<Mapeamento>({});
  const [linhas, setLinhas] = useState<LinhaValidada[] | null>(null);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [desmarcadas, setDesmarcadas] = useState<Set<number>>(new Set());
  const [substituir, setSubstituir] = useState(false);
  const [soProblemas, setSoProblemas] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  // Muda a cada "importar outro arquivo" para limpar o campo de arquivo.
  const [chaveArquivo, setChaveArquivo] = useState(0);

  const planilha: Planilha | null = useMemo(
    () => (abas[abaIdx] ? separarCabecalho(abas[abaIdx].dados) : null),
    [abas, abaIdx]
  );
  const campos = CAMPOS[tipo];
  const usaBanco = tipo !== "caixa_diario";

  function recomecar() {
    setLinhas(null);
    setMarcadas(new Set());
    setDesmarcadas(new Set());
    setResumo(null);
    setErro(null);
  }

  function trocarTipo(t: TipoImportacao) {
    setTipo(t);
    recomecar();
    if (abas.length) {
      const i = abaDoTipo(abas, t);
      setAbaIdx(i);
      setMapa(mapearAutomatico(t, separarCabecalho(abas[i].dados).cabecalho));
    }
  }

  async function escolherArquivo(arquivo: File | undefined) {
    recomecar();
    setAbas([]);
    setNomeArquivo("");
    if (!arquivo) return;
    setOcupado("Lendo o arquivo…");
    try {
      const lidas = (await lerArquivo(arquivo)).filter((a) => a.dados.length > 0);
      if (!lidas.length) throw new Error("O arquivo está vazio.");
      const i = abaDoTipo(lidas, tipo);
      setAbas(lidas);
      setAbaIdx(i);
      setNomeArquivo(arquivo.name);
      setMapa(mapearAutomatico(tipo, separarCabecalho(lidas[i].dados).cabecalho));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      setOcupado(null);
    }
  }

  async function conferir() {
    if (!planilha) return;
    recomecar();
    setOcupado("Conferindo as linhas…");
    try {
      let v = validarLinhas(tipo, planilha, mapa, referencias, { empresaId, lojaId, bancoPadraoId: bancoId || null });
      const periodo = periodoDasLinhas(v);
      const existentes = periodo ? await buscarExistentes(empresaId, tipo, periodo.ini, periodo.fim) : {};
      v = marcarDuplicados(tipo, v, existentes, lojaId);
      setLinhas(v);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível conferir.");
    } finally {
      setOcupado(null);
    }
  }

  const escolhidas = useMemo(
    () => (linhas ? escolherParaGravar(linhas, { substituirConflitos: substituir, marcadas, desmarcadas }) : []),
    [linhas, substituir, marcadas, desmarcadas]
  );
  const numerosEscolhidos = useMemo(() => new Set(escolhidas.map((l) => l.numero)), [escolhidas]);
  const totalEscolhido = escolhidas.reduce((s, l) => s + valorDaLinha(l), 0);
  const contagem = useMemo(() => {
    const c = { ok: 0, duplicado: 0, conflito: 0, erro: 0 };
    for (const l of linhas ?? []) c[l.situacao]++;
    return c;
  }, [linhas]);

  function alternar(l: LinhaValidada, marcado: boolean) {
    if (l.situacao === "ok") {
      const s = new Set(desmarcadas);
      if (marcado) s.delete(l.numero);
      else s.add(l.numero);
      setDesmarcadas(s);
    } else if (l.situacao === "duplicado") {
      const s = new Set(marcadas);
      if (marcado) s.add(l.numero);
      else s.delete(l.numero);
      setMarcadas(s);
    }
  }

  async function importar() {
    if (!linhas || !planilha || !escolhidas.length) return;
    setErro(null);
    setOcupado("Importando…");
    setProgresso({ feito: 0, total: escolhidas.length });
    const lote = await criarLote({ empresaId, tipo, arquivo: nomeArquivo, lojaId, linhasArquivo: planilha.linhas.length });
    if (!lote.ok || !lote.id) {
      setErro(lote.erro ?? "Não foi possível iniciar a importação.");
      setOcupado(null);
      setProgresso(null);
      return;
    }
    const resultados: ResultadoLinha[] = [];
    try {
      for (let i = 0; i < escolhidas.length; i += PEDACO) {
        const pedaco = escolhidas.slice(i, i + PEDACO).map((l) => ({
          numero: l.numero,
          pagamento: l.pagamento,
          receita: l.receita,
          caixa: l.caixa ? { data: l.caixa.data, tipo_venda: l.caixa.tipo_venda, valor: l.caixa.valor } : undefined,
        }));
        resultados.push(...(await gravarLinhas(lote.id, empresaId, lojaId, tipo, pedaco)));
        setProgresso({ feito: Math.min(i + PEDACO, escolhidas.length), total: escolhidas.length });
      }
    } catch (e) {
      setErro(
        `A importação parou no meio (${resultados.length} de ${escolhidas.length} linhas processadas). ` +
          `O que entrou está no lote e pode ser desfeito no histórico abaixo. ${e instanceof Error ? e.message : ""}`
      );
    }

    const entrou = resultados.filter((r) => r.ok);
    const valor = entrou.reduce((s, r) => s + r.valor, 0);
    const porNumero = new Map(linhas.map((l) => [l.numero, l]));
    const rejeitadas: Rejeitada[] = [];
    const escolhidasSet = new Set(escolhidas.map((l) => l.numero));
    for (const l of linhas) {
      if (escolhidasSet.has(l.numero)) continue;
      const motivo =
        l.situacao === "erro"
          ? l.motivos.join("; ")
          : l.situacao === "duplicado"
            ? `não importada: ${l.motivos.join("; ")}`
            : l.situacao === "conflito"
              ? `pulada: o dia já tinha ${brl(l.caixa?.valorExistente)} lançado`
              : "desmarcada na conferência";
      rejeitadas.push({ numero: l.numero, original: l.original, motivo });
    }
    const avisos: string[] = [];
    for (const r of resultados) {
      if (!r.ok) rejeitadas.push({ numero: r.numero, original: porNumero.get(r.numero)?.original ?? [], motivo: `erro ao gravar: ${r.erro}` });
      else if (r.erro) avisos.push(`Linha ${r.numero}: ${r.erro}`);
    }
    rejeitadas.sort((a, b) => a.numero - b.numero);

    await finalizarLote(lote.id, { importadas: entrou.length, rejeitadas: linhas.length - entrou.length, valor });
    setResumo({ importadas: entrou.length, valor, rejeitadas, avisos });
    setLinhas(null);
    setOcupado(null);
    setProgresso(null);
    router.refresh();
  }

  function baixarRejeitadas() {
    if (!resumo || !planilha) return;
    const blob = new Blob([csvRejeitadas(planilha.cabecalho, resumo.rejeitadas)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rejeitadas-${nomeArquivo.replace(/\.[^.]+$/, "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const visiveis = (linhas ?? []).filter((l) => !soProblemas || l.situacao !== "ok");
  // Linha com erro nao tem valor interpretado: mostra o que veio no arquivo.
  const bruto = (l: LinhaValidada, chave: string) => {
    const i = mapa[chave];
    const t = i === undefined || i < 0 ? "" : textoCelula(l.original[i]);
    return t ? <span className="italic">{t}</span> : "—";
  };
  const nomeCodigo = new Map(referencias.codigos.map((c) => [c.codigo, c.nome]));
  const nomeTipoRec = new Map(referencias.tiposRecebimento.map((c) => [c.codigo, c.nome]));
  const nomeTipoVenda = new Map(referencias.tiposVenda.map((c) => [c.codigo, c.nome]));

  return (
    <div className="space-y-6">
      {/* 1. Tipo, loja, arquivo */}
      <Cartao className="p-4">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">1. O que você vai importar</p>
          <a href={MODELO} download className="text-sm font-medium text-marca hover:underline">
            Baixar planilha modelo (.xlsx)
          </a>
        </div>
        <div className="mb-4 grid gap-2 md:grid-cols-3">
          {TIPOS.map((t) => (
            <label
              key={t}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                tipo === t ? "border-marca bg-marca-clara font-medium text-marca" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input type="radio" name="tipo" checked={tipo === t} onChange={() => trocarTipo(t)} className="h-4 w-4" />
              {ROTULO_TIPO[t]}
            </label>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Campo rotulo="Loja">
            <select value={lojaId} onChange={(e) => { setLojaId(e.target.value); recomecar(); }} className={inputCls}>
              {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </Campo>
          {usaBanco && (
            <Campo rotulo="Banco padrão (se a planilha não trouxer)">
              <select value={bancoId} onChange={(e) => { setBancoId(e.target.value); recomecar(); }} className={inputCls}>
                <option value="">—</option>
                {referencias.bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
              </select>
            </Campo>
          )}
          <Campo rotulo="Arquivo (.xlsx ou .csv)">
            <input
              key={chaveArquivo}
              type="file"
              accept=".xlsx,.csv,.txt"
              onChange={(e) => escolherArquivo(e.target.files?.[0])}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
            />
          </Campo>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {tipo === "pagamentos" &&
            "Cada linha vira um lançamento de Pagamentos (competência = mês do vencimento, se a planilha não disser outro). Linha com data de pagamento entra já paga, com a baixa nessa data — é ela que vai para o DFC."}
          {tipo === "receitas" && "Cada linha vira uma entrada em Receitas — é o que alimenta o DFC (regime de caixa)."}
          {tipo === "caixa_diario" &&
            "Cada linha soma no Caixa Diário do dia e tipo de venda — é o que alimenta o faturamento da DRE e o Faturamento Diário. Linhas do mesmo dia e tipo são somadas."}{" "}
          PDF ainda não é importado.
        </p>
      </Cartao>

      {/* 2. Colunas */}
      {planilha && !resumo && (
        <Cartao className="p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">2. Ligue as colunas do arquivo aos campos do sistema</p>
            <p className="text-xs text-slate-500">
              {nomeArquivo} — {planilha.linhas.length} linha(s)
            </p>
          </div>
          {abas.length > 1 && (
            <Campo rotulo="Aba da planilha" className="mb-3 max-w-xs">
              <select
                value={abaIdx}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  setAbaIdx(i);
                  setMapa(mapearAutomatico(tipo, separarCabecalho(abas[i].dados).cabecalho));
                  recomecar();
                }}
                className={inputCls}
              >
                {abas.map((a, i) => <option key={i} value={i}>{a.nome}</option>)}
              </select>
            </Campo>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {campos.map((c) => (
              <Campo key={c.chave} rotulo={`${c.rotulo}${c.obrigatorio ? " *" : ""}`}>
                <select
                  value={mapa[c.chave] ?? -1}
                  onChange={(e) => { setMapa({ ...mapa, [c.chave]: Number(e.target.value) }); recomecar(); }}
                  className={`${inputCls} ${c.obrigatorio && !(mapa[c.chave] >= 0) ? "border-red-300" : ""}`}
                >
                  <option value={-1}>— não usar —</option>
                  {planilha.cabecalho.map((h, i) => (
                    <option key={i} value={i}>{h || `(coluna ${i + 1})`}</option>
                  ))}
                </select>
                {c.ajuda && <span className="mt-0.5 block text-[11px] text-slate-400">{c.ajuda}</span>}
              </Campo>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={conferir}
              disabled={!!ocupado}
              className="rounded-lg bg-marca px-5 py-2 text-sm font-semibold text-white hover:bg-marca-escura disabled:opacity-50"
            >
              Conferir linhas
            </button>
          </div>
        </Cartao>
      )}

      {ocupado && (
        <p className="text-sm text-marca">
          {ocupado}
          {progresso && ` ${progresso.feito} de ${progresso.total}`}
        </p>
      )}
      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      {/* 3. Conferencia */}
      {linhas && (
        <Cartao className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold">3. Confira antes de gravar</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className={`rounded px-2 py-0.5 ${SITUACAO.ok.cls}`}>{contagem.ok} ok</span>
              {contagem.duplicado > 0 && <span className={`rounded px-2 py-0.5 ${SITUACAO.duplicado.cls}`}>{contagem.duplicado} duplicada(s)</span>}
              {contagem.conflito > 0 && <span className={`rounded px-2 py-0.5 ${SITUACAO.conflito.cls}`}>{contagem.conflito} dia(s) já lançado(s)</span>}
              {contagem.erro > 0 && <span className={`rounded px-2 py-0.5 ${SITUACAO.erro.cls}`}>{contagem.erro} com erro</span>}
              <label className="ml-2 flex items-center gap-1 text-slate-500">
                <input type="checkbox" checked={soProblemas} onChange={(e) => setSoProblemas(e.target.checked)} />
                só as com problema
              </label>
            </div>
          </div>
          {contagem.duplicado > 0 && (
            <p className="mb-2 text-xs text-slate-500">
              Duplicadas vêm desmarcadas. Se forem lançamentos diferentes de verdade (ex.: dois boletos iguais no mesmo dia), marque para importar.
            </p>
          )}
          {contagem.conflito > 0 && (
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} className="h-4 w-4" />
              Substituir o valor dos dias que já estão lançados no Caixa Diário (sem marcar, esses dias são pulados)
            </label>
          )}
          <div className="max-h-[28rem] overflow-auto rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2" />
                  <th className="px-2 py-2 text-left font-semibold">Linha</th>
                  <th className="px-2 py-2 text-left font-semibold">Situação</th>
                  <th className="px-2 py-2 text-left font-semibold">{tipo === "pagamentos" ? "Vencimento" : "Data"}</th>
                  <th className="px-2 py-2 text-left font-semibold">{tipo === "pagamentos" ? "Código" : "Tipo"}</th>
                  {tipo !== "caixa_diario" && <th className="px-2 py-2 text-left font-semibold">Descrição</th>}
                  {tipo === "pagamentos" && (
                    <>
                      <th className="px-2 py-2 text-left font-semibold">CFC</th>
                      <th className="px-2 py-2 text-left font-semibold">Comp.</th>
                      <th className="px-2 py-2 text-left font-semibold">Pago em</th>
                    </>
                  )}
                  <th className="px-2 py-2 text-right font-semibold">Valor</th>
                  <th className="px-2 py-2 text-left font-semibold">Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiveis.map((l) => {
                  const marcado = numerosEscolhidos.has(l.numero);
                  const s = SITUACAO[l.situacao];
                  const p = l.pagamento;
                  const r = l.receita;
                  const c = l.caixa;
                  return (
                    <tr key={l.numero} className={marcado ? "" : "text-slate-400"}>
                      <td className="px-2 py-1">
                        <input
                          type="checkbox"
                          checked={marcado}
                          disabled={l.situacao === "erro" || l.situacao === "conflito"}
                          onChange={(e) => alternar(l, e.target.checked)}
                        />
                      </td>
                      <td className="px-2 py-1 tabular-nums">{c && c.linhasSomadas.length > 1 ? c.linhasSomadas.join(", ") : l.numero}</td>
                      <td className="px-2 py-1"><span className={`rounded px-1.5 py-0.5 text-xs ${s.cls}`}>{s.rotulo}</span></td>
                      <td className="whitespace-nowrap px-2 py-1 tabular-nums">
                        {p ? formatarDataBR(p.vencimento) : r ? formatarDataBR(r.data) : c ? formatarDataBR(c.data) : bruto(l, tipo === "pagamentos" ? "vencimento" : "data")}
                      </td>
                      <td className="px-2 py-1">
                        {p ? `${p.cd} - ${nomeCodigo.get(p.cd) ?? ""}` : r ? nomeTipoRec.get(r.tipo_recebimento) : c ? nomeTipoVenda.get(c.tipo_venda) : bruto(l, tipo === "pagamentos" ? "codigo" : "tipo")}
                      </td>
                      {tipo !== "caixa_diario" && <td className="max-w-[14rem] truncate px-2 py-1">{p?.descricao ?? r?.descricao ?? bruto(l, "descricao")}</td>}
                      {tipo === "pagamentos" && (
                        <>
                          <td className="px-2 py-1" title={p?.cfcSugerido ? "sugerido pelo grupo do código" : undefined}>
                            {p ? `${p.cfc}${p.cfcSugerido ? "*" : ""}` : ""}
                          </td>
                          <td className="px-2 py-1 tabular-nums">{p ? `${String(p.comp_mes).padStart(2, "0")}/${p.comp_ano}` : ""}</td>
                          <td className="px-2 py-1 tabular-nums">{p?.data_pagamento ? formatarDataBR(p.data_pagamento) : p ? "em aberto" : ""}</td>
                        </>
                      )}
                      <td className="px-2 py-1 text-right tabular-nums">{!p && !r && !c ? bruto(l, "valor") : brl(valorDaLinha(l))}</td>
                      <td className="px-2 py-1 text-xs">
                        {l.motivos.join("; ")}
                        {c?.valorExistente !== undefined && ` (hoje: ${brl(c.valorExistente)})`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {tipo === "pagamentos" && <p className="mt-2 text-[11px] text-slate-400">* CFC sugerido pelo grupo do código (a planilha não trouxe).</p>}
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={recomecar} className="text-sm text-slate-500 hover:underline">
              Voltar
            </button>
            <button
              type="button"
              onClick={importar}
              disabled={!!ocupado || escolhidas.length === 0}
              className="rounded-lg bg-marca px-5 py-2 text-sm font-semibold text-white hover:bg-marca-escura disabled:opacity-50"
            >
              Importar {escolhidas.length} {escolhidas.length === 1 ? "linha" : "linhas"} — {brl(totalEscolhido)}
            </button>
          </div>
        </Cartao>
      )}

      {/* 4. Resumo */}
      {resumo && (
        <Cartao className="p-4">
          <p className="mb-2 text-sm font-semibold">Importação concluída</p>
          <p className="text-sm">
            <strong>{resumo.importadas}</strong> {resumo.importadas === 1 ? "linha entrou" : "linhas entraram"}, somando{" "}
            <strong>{brl(resumo.valor)}</strong>. {resumo.rejeitadas.length > 0 && <><strong>{resumo.rejeitadas.length}</strong> ficaram de fora.</>}
          </p>
          {resumo.avisos.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-amber-700">
              {resumo.avisos.map((a) => <li key={a}>{a}</li>)}
            </ul>
          )}
          {resumo.rejeitadas.length > 0 && (
            <>
              <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold">Linha</th>
                      <th className="px-2 py-2 text-left font-semibold">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resumo.rejeitadas.map((r) => (
                      <tr key={`${r.numero}-${r.motivo}`}>
                        <td className="px-2 py-1 tabular-nums">{r.numero}</td>
                        <td className="px-2 py-1">{r.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={baixarRejeitadas} className="mt-3 text-sm font-medium text-marca hover:underline">
                Baixar as linhas que ficaram de fora (.csv), para corrigir e importar de novo
              </button>
            </>
          )}
          <p className="mt-3 text-xs text-slate-500">Se algo não estiver certo, desfaça a importação inteira no histórico abaixo.</p>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => { setResumo(null); setAbas([]); setNomeArquivo(""); setChaveArquivo((k) => k + 1); }}
              className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm hover:bg-slate-50"
            >
              Importar outro arquivo
            </button>
          </div>
        </Cartao>
      )}
    </div>
  );
}
