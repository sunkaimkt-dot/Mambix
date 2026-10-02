/**
 * Importacao em massa (Combo 3) -- parte PURA: nao fala com o banco nem com o
 * Next. Le CSV, interpreta numero/data no formato brasileiro, liga as colunas
 * do arquivo aos campos do sistema, valida linha a linha e marca duplicados.
 *
 * Quem grava e importacao-acoes.ts, sempre pelas MESMAS actions das telas
 * (salvarPagamento / salvarReceita / salvarCaixa).
 */

export type TipoImportacao = "pagamentos" | "receitas" | "caixa_diario";

export type Celula = string | number | boolean | Date | null | undefined;

export const ROTULO_TIPO: Record<TipoImportacao, string> = {
  pagamentos: "Pagamentos (contas a pagar e pagas)",
  receitas: "Receitas (entradas de dinheiro)",
  caixa_diario: "Caixa Diário (vendas por tipo)",
};

export type Campo = {
  chave: string;
  rotulo: string;
  obrigatorio: boolean;
  ajuda?: string;
  /** Cabecalhos que o sistema reconhece sozinho (ja normalizados). */
  apelidos: string[];
};

export const CAMPOS: Record<TipoImportacao, Campo[]> = {
  pagamentos: [
    { chave: "vencimento", rotulo: "Vencimento", obrigatorio: true, apelidos: ["vencimento", "venc", "data vencimento", "data de vencimento", "dt vencimento", "data"] },
    { chave: "codigo", rotulo: "Código da despesa", obrigatorio: true, apelidos: ["codigo", "cod", "cd", "codigo despesa", "codigo da despesa", "conta"] },
    { chave: "descricao", rotulo: "Descrição", obrigatorio: false, apelidos: ["descricao", "historico", "desc", "fornecedor"] },
    { chave: "valor", rotulo: "Valor", obrigatorio: true, apelidos: ["valor", "valor r$", "vlr", "valor nominal", "valor do documento"] },
    { chave: "cfc", rotulo: "CFC", obrigatorio: false, ajuda: "Se não vier, o sistema sugere pelo grupo do código.", apelidos: ["cfc", "classificacao", "classificacao cfc"] },
    { chave: "competencia", rotulo: "Competência (mês/ano)", obrigatorio: false, ajuda: "Se não vier, segue o mês do vencimento.", apelidos: ["competencia", "comp", "mes competencia", "mes/ano"] },
    { chave: "data_pagamento", rotulo: "Data de pagamento", obrigatorio: false, ajuda: "Preenchida = conta já paga (baixa integral nessa data).", apelidos: ["data pagamento", "data de pagamento", "pago em", "dt pagamento", "pagamento", "data pgto", "pgto"] },
    { chave: "forma", rotulo: "Forma de pagamento", obrigatorio: false, apelidos: ["forma de pagamento", "forma pagamento", "forma", "cp"] },
    { chave: "banco", rotulo: "Banco / caixa", obrigatorio: false, ajuda: "Se não vier, usa o banco escolhido na tela.", apelidos: ["banco", "conta bancaria", "caixa"] },
  ],
  receitas: [
    { chave: "data", rotulo: "Data", obrigatorio: true, apelidos: ["data", "data recebimento", "data de recebimento", "dt"] },
    { chave: "tipo", rotulo: "Tipo de recebimento", obrigatorio: true, ajuda: "Código (1–20) ou nome, como em Códigos e listas.", apelidos: ["tipo", "tipo de recebimento", "tipo recebimento", "forma de recebimento"] },
    { chave: "descricao", rotulo: "Descrição", obrigatorio: false, apelidos: ["descricao", "historico", "desc", "cliente"] },
    { chave: "valor", rotulo: "Valor", obrigatorio: true, apelidos: ["valor", "valor r$", "vlr"] },
    { chave: "banco", rotulo: "Banco", obrigatorio: false, ajuda: "Se não vier, usa o banco escolhido na tela.", apelidos: ["banco", "conta bancaria"] },
  ],
  caixa_diario: [
    { chave: "data", rotulo: "Data", obrigatorio: true, apelidos: ["data", "dia", "data da venda"] },
    { chave: "tipo", rotulo: "Tipo de venda", obrigatorio: true, ajuda: "Código (1–20) ou nome, como em Códigos e listas.", apelidos: ["tipo", "tipo de venda", "tipo venda", "forma de venda"] },
    { chave: "valor", rotulo: "Valor", obrigatorio: true, apelidos: ["valor", "valor r$", "vlr", "total"] },
  ],
};

// ============================================================
// Texto
// ============================================================

/** minusculo, sem acento, sem espaco sobrando -- para comparar nomes e cabecalhos. */
export function normalizar(t: unknown): string {
  return String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\-.:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function textoCelula(v: Celula): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return dataISO(v) ?? "";
  return String(v).trim();
}

// ============================================================
// CSV
// ============================================================

/**
 * Decodifica o arquivo: tenta UTF-8; se tiver byte invalido, cai para
 * Windows-1252 (o "ANSI" que o Excel brasileiro grava em "CSV (separado por
 * virgulas)").
 */
export function decodificarTexto(bytes: Uint8Array): string {
  let t: string;
  try {
    t = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    t = new TextDecoder("windows-1252").decode(bytes);
  }
  return t.replace(/^﻿/, "");
}

/** CSV com ; , ou TAB (descobre sozinho pela primeira linha), aspas e quebras dentro de aspas. */
export function lerCSV(texto: string): string[][] {
  const primeira = texto.split(/\r?\n/, 1)[0] ?? "";
  const conta = (c: string) => primeira.split(c).length - 1;
  const sep = [";", "\t", ","].sort((a, b) => conta(b) - conta(a))[0];

  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else aspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"' && campo === "") aspas = true;
    else if (c === sep) { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      linhas.push(linha); linha = [];
    } else campo += c;
  }
  if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

// ============================================================
// Numero e data no formato brasileiro
// ============================================================

/** "1.234,56" / "R$ 1.234,56" / "1234.56" / "(10,00)" / numero do Excel. null = nao e numero. */
export function lerNumero(v: Celula): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  if (typeof v !== "string") return null;
  let t = v.trim().replace(/\s|R\$/gi, "");
  if (t === "") return null;
  let negativo = false;
  if (/^\(.*\)$/.test(t)) { negativo = true; t = t.slice(1, -1); }
  if (t.startsWith("-")) { negativo = !negativo; t = t.slice(1); }
  if (t.endsWith("-")) { negativo = !negativo; t = t.slice(0, -1); }
  if (!/^[\d.,]+$/.test(t)) return null;
  const ultVirg = t.lastIndexOf(",");
  const ultPonto = t.lastIndexOf(".");
  if (ultVirg >= 0 && ultPonto >= 0) {
    // Os dois aparecem: o ultimo e o decimal.
    t = ultVirg > ultPonto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (ultVirg >= 0) {
    if ((t.match(/,/g) ?? []).length > 1) return null;
    t = t.replace(",", ".");
  } else if (ultPonto >= 0) {
    // So ponto: "1.234" ou "1.234.567" e milhar; "1234.5" e decimal.
    if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    else if ((t.match(/\./g) ?? []).length > 1) return null;
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round((negativo ? -n : n) * 100) / 100;
}

function montarData(a: number, m: number, d: number): string | null {
  if (a < 100) a += 2000;
  if (a < 2000 || a > 2100 || m < 1 || m > 12 || d < 1) return null;
  if (d > new Date(Date.UTC(a, m, 0)).getUTCDate()) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Data -> "AAAA-MM-DD". Aceita Date (o read-excel-file entrega a data do Excel
 * como meia-noite UTC), "dd/mm/aaaa", "dd/mm/aa", "dd-mm-aaaa", "dd.mm.aaaa" e
 * "aaaa-mm-dd". Data que nao existe (31/02) e recusada.
 */
export function lerData(v: Celula): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return montarData(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  }
  const t = String(v).trim().split(/[ T]/)[0];
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return montarData(Number(m[1]), Number(m[2]), Number(m[3]));
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) return montarData(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

function dataISO(d: Date): string | null {
  return lerData(d);
}

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Competencia: "09/2026", "9/26", "2026-09", "set/2026", "setembro/2026" ou uma data. */
export function lerCompetencia(v: Celula): { mes: number; ano: number } | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    const d = lerData(v);
    return d ? { ano: Number(d.slice(0, 4)), mes: Number(d.slice(5, 7)) } : null;
  }
  const t = normalizar(v).replace(/ /g, "");
  let m = t.match(/^(\d{1,2})[/-](\d{2}|\d{4})$/);
  let mes: number | null = null;
  let ano: number | null = null;
  if (m) { mes = Number(m[1]); ano = Number(m[2]); }
  else if ((m = t.match(/^(\d{4})[/-](\d{1,2})$/))) { ano = Number(m[1]); mes = Number(m[2]); }
  else if ((m = t.match(/^([a-z]{3})[a-z]*[/-]?(\d{2}|\d{4})$/))) {
    const i = MESES_ABREV.indexOf(m[1]);
    if (i >= 0) { mes = i + 1; ano = Number(m[2]); }
  } else {
    const d = lerData(String(v));
    if (d) return { ano: Number(d.slice(0, 4)), mes: Number(d.slice(5, 7)) };
  }
  if (mes === null || ano === null) return null;
  if (ano < 100) ano += 2000;
  if (mes < 1 || mes > 12 || ano < 2000 || ano > 2100) return null;
  return { mes, ano };
}

export function formatarDataBR(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

// ============================================================
// Planilha -> cabecalho + linhas
// ============================================================

/** numeros: numero real de cada linha na planilha (para o usuario achar o erro). */
export type Planilha = { cabecalho: string[]; linhas: Celula[][]; numeros: number[] };

/** Primeira linha nao vazia vira cabecalho; linhas totalmente vazias sao ignoradas. */
export function separarCabecalho(dados: Celula[][]): Planilha {
  const vazia = (l: Celula[]) => l.every((c) => textoCelula(c) === "");
  let i = 0;
  while (i < dados.length && vazia(dados[i])) i++;
  const cabecalho = (dados[i] ?? []).map((c) => textoCelula(c));
  const linhas: Celula[][] = [];
  const numeros: number[] = [];
  for (let j = i + 1; j < dados.length; j++) {
    if (vazia(dados[j])) continue;
    linhas.push(dados[j]);
    numeros.push(j + 1);
  }
  return { cabecalho, linhas, numeros };
}

/** Mapeamento: campo do sistema -> indice da coluna no arquivo (-1 = nao veio). */
export type Mapeamento = Record<string, number>;

export function mapearAutomatico(tipo: TipoImportacao, cabecalho: string[]): Mapeamento {
  const norm = cabecalho.map(normalizar);
  const usado = new Set<number>();
  const mapa: Mapeamento = {};
  // Primeiro casamento exato, depois "contem" -- assim "data de pagamento" nao
  // e roubada pelo campo "data" quando as duas colunas existem.
  for (const passo of ["exato", "contem"] as const) {
    for (const campo of CAMPOS[tipo]) {
      if (mapa[campo.chave] !== undefined && mapa[campo.chave] >= 0) continue;
      let achou = -1;
      for (const ap of campo.apelidos) {
        achou = norm.findIndex((h, k) => !usado.has(k) && (passo === "exato" ? h === ap : h.length > 2 && h.includes(ap) && ap.length > 3));
        if (achou >= 0) break;
      }
      if (achou >= 0) { mapa[campo.chave] = achou; usado.add(achou); }
      else if (passo === "contem") mapa[campo.chave] = -1;
    }
  }
  return mapa;
}

// ============================================================
// Validacao
// ============================================================

export type Opcao = { codigo: number; nome: string; grupo?: string };

export type Referencias = {
  codigos: Opcao[];        // codigos_despesa (com grupo)
  formas: Opcao[];         // formas_pagamento
  tiposRecebimento: Opcao[];
  tiposVenda: Opcao[];
  bancos: { id: string; nome: string }[];
};

export type Configuracao = {
  empresaId: string;
  lojaId: string | null;
  bancoPadraoId: string | null;
};

/** O que vai para a action. Valores ja interpretados. */
export type LinhaPagamento = {
  vencimento: string;
  cd: number;
  cfc: number;
  cfcSugerido: boolean;
  descricao: string;
  valor: number;
  comp_mes: number;
  comp_ano: number;
  data_pagamento: string | null;
  cp: number | null;
  banco_id: string | null;
};
export type LinhaReceita = { data: string; tipo_recebimento: number; descricao: string; valor: number; banco_id: string | null };
export type LinhaCaixa = { data: string; tipo_venda: number; valor: number };

export type Situacao = "ok" | "duplicado" | "conflito" | "erro";

export type LinhaValidada = {
  numero: number;              // linha no arquivo (1 = primeira linha da planilha)
  situacao: Situacao;
  motivos: string[];
  pagamento?: LinhaPagamento;
  receita?: LinhaReceita;
  caixa?: LinhaCaixa & { linhasSomadas: number[]; valorExistente?: number };
  original: Celula[];
};

/**
 * CFC sugerido quando a planilha nao traz: segue o grupo do codigo, que e a
 * classificacao gerencial usual --
 *   Variaveis (81-90) e Estoque/materia-prima (100) -> 2 variavel
 *   Investimentos (91-98)                            -> 4 investimento
 *   Retirada de socio (99)                           -> 3 nao operacional
 *   demais grupos (pro-labore, RH, fixas, impostos, financeiras) -> 1 fixa
 */
export function cfcSugerido(grupo: string | undefined): number {
  switch (grupo) {
    case "VARIAVEIS":
    case "ESTOQUE":
      return 2;
    case "INVESTIMENTOS":
      return 4;
    case "RETIRADA_SOCIO":
      return 3;
    default:
      return 1;
  }
}

function acharOpcao(lista: Opcao[], v: Celula): Opcao | null {
  const n = lerNumero(v);
  if (n !== null && Number.isInteger(n)) return lista.find((o) => o.codigo === n && o.nome !== "") ?? null;
  const t = normalizar(v);
  if (!t) return null;
  // "5 - CARTAO CREDITO" tambem vale.
  const m = t.match(/^(\d+)\s/);
  if (m) return lista.find((o) => o.codigo === Number(m[1]) && o.nome !== "") ?? null;
  return lista.find((o) => o.nome !== "" && normalizar(o.nome) === t) ?? null;
}

function acharBanco(bancos: { id: string; nome: string }[], v: Celula) {
  const t = normalizar(v);
  if (!t) return undefined;
  return bancos.find((b) => normalizar(b.nome) === t) ?? null;
}

function celula(l: Celula[], mapa: Mapeamento, chave: string): Celula {
  const i = mapa[chave];
  return i === undefined || i < 0 ? null : l[i];
}

function vazio(v: Celula) {
  return textoCelula(v) === "";
}

/** Valida e interpreta cada linha. Nao olha o banco -- duplicados vem depois. */
export function validarLinhas(
  tipo: TipoImportacao,
  planilha: Planilha,
  mapa: Mapeamento,
  ref: Referencias,
  cfg: Configuracao
): LinhaValidada[] {
  const numeros = planilha.numeros;
  const faltando = CAMPOS[tipo].filter((c) => c.obrigatorio && !(mapa[c.chave] >= 0));

  return planilha.linhas.map((l, k) => {
    const motivos: string[] = [];
    const base: LinhaValidada = { numero: numeros[k], situacao: "ok", motivos, original: l };
    for (const f of faltando) motivos.push(`coluna "${f.rotulo}" não foi escolhida`);

    const valor = lerNumero(celula(l, mapa, "valor"));
    if (vazio(celula(l, mapa, "valor"))) motivos.push("valor vazio");
    else if (valor === null) motivos.push("valor não é um número");
    else if (valor === 0) motivos.push("valor zerado");
    else if (valor < 0) motivos.push("valor negativo");

    const bancoCel = celula(l, mapa, "banco");
    let bancoId = cfg.bancoPadraoId;
    if (!vazio(bancoCel)) {
      const b = acharBanco(ref.bancos, bancoCel);
      if (!b) motivos.push(`banco "${textoCelula(bancoCel)}" não cadastrado`);
      else bancoId = b.id;
    }

    if (tipo === "pagamentos") {
      const vencimento = lerData(celula(l, mapa, "vencimento"));
      if (!vencimento) motivos.push(vazio(celula(l, mapa, "vencimento")) ? "vencimento vazio" : "vencimento inválido");

      const codCel = celula(l, mapa, "codigo");
      const codigo = acharOpcao(ref.codigos, codCel);
      if (vazio(codCel)) motivos.push("código vazio");
      else if (!codigo) motivos.push(`código "${textoCelula(codCel)}" inexistente ou sem nome`);

      let cfc = cfcSugerido(codigo?.grupo);
      let sugerido = true;
      const cfcCel = celula(l, mapa, "cfc");
      if (!vazio(cfcCel)) {
        const n = lerNumero(cfcCel);
        if (n === null || !Number.isInteger(n) || n < 1 || n > 4) motivos.push("CFC fora de 1 a 4");
        else { cfc = n; sugerido = false; }
      }

      let comp = vencimento ? { ano: Number(vencimento.slice(0, 4)), mes: Number(vencimento.slice(5, 7)) } : null;
      const compCel = celula(l, mapa, "competencia");
      if (!vazio(compCel)) {
        const c = lerCompetencia(compCel);
        if (!c) motivos.push("competência inválida (use mm/aaaa)");
        else comp = c;
      }

      let dataPag: string | null = null;
      const pagCel = celula(l, mapa, "data_pagamento");
      if (!vazio(pagCel)) {
        dataPag = lerData(pagCel);
        if (!dataPag) motivos.push("data de pagamento inválida");
      }

      let cp: number | null = null;
      const formaCel = celula(l, mapa, "forma");
      if (!vazio(formaCel)) {
        const f = acharOpcao(ref.formas, formaCel);
        if (!f) motivos.push(`forma de pagamento "${textoCelula(formaCel)}" não cadastrada`);
        else cp = f.codigo;
      }

      if (vencimento && codigo && valor && comp) {
        base.pagamento = {
          vencimento,
          cd: codigo.codigo,
          cfc,
          cfcSugerido: sugerido,
          descricao: textoCelula(celula(l, mapa, "descricao")),
          valor,
          comp_mes: comp.mes,
          comp_ano: comp.ano,
          data_pagamento: dataPag,
          cp,
          banco_id: bancoId,
        };
      }
    } else {
      const data = lerData(celula(l, mapa, "data"));
      if (!data) motivos.push(vazio(celula(l, mapa, "data")) ? "data vazia" : "data inválida");
      const lista = tipo === "receitas" ? ref.tiposRecebimento : ref.tiposVenda;
      const tipoCel = celula(l, mapa, "tipo");
      const t = acharOpcao(lista, tipoCel);
      const nomeTipo = tipo === "receitas" ? "tipo de recebimento" : "tipo de venda";
      if (vazio(tipoCel)) motivos.push(`${nomeTipo} vazio`);
      else if (!t) motivos.push(`${nomeTipo} "${textoCelula(tipoCel)}" inexistente ou sem nome`);

      if (data && t && valor) {
        if (tipo === "receitas") {
          base.receita = {
            data,
            tipo_recebimento: t.codigo,
            descricao: textoCelula(celula(l, mapa, "descricao")),
            valor,
            banco_id: bancoId,
          };
        } else {
          base.caixa = { data, tipo_venda: t.codigo, valor, linhasSomadas: [base.numero] };
        }
      }
    }

    if (motivos.length) base.situacao = "erro";
    return base;
  });
}

// ============================================================
// Duplicados
// ============================================================

/** O que ja existe no banco, no periodo do arquivo (ver buscarExistentes). */
export type Existentes = {
  pagamentos?: { loja_id: string | null; vencimento: string; cd: number; valor: number; descricao: string }[];
  receitas?: { loja_id: string | null; data: string; tipo_recebimento: number; valor: number; descricao: string }[];
  caixa?: { loja_id: string | null; data: string; tipo_venda: number; valor: number }[];
};

const centavos = (v: number) => Math.round(v * 100);

export function chavePagamento(loja: string | null, p: { vencimento: string; cd: number; valor: number; descricao: string }) {
  return [loja ?? "", p.vencimento, p.cd, centavos(Number(p.valor)), normalizar(p.descricao)].join("|");
}
export function chaveReceita(loja: string | null, r: { data: string; tipo_recebimento: number; valor: number; descricao: string }) {
  return [loja ?? "", r.data, r.tipo_recebimento, centavos(Number(r.valor)), normalizar(r.descricao)].join("|");
}
export function chaveCaixa(loja: string | null, c: { data: string; tipo_venda: number }) {
  return [loja ?? "", c.data, c.tipo_venda].join("|");
}

/**
 * Marca duplicados (no proprio arquivo e contra o banco).
 *
 * Pagamentos e receitas: mesma loja + data + codigo/tipo + valor + descricao.
 *   Duplicado nao e erro -- vem desmarcado e o usuario pode importar mesmo assim
 *   (dois boletos iguais no mesmo dia existem).
 *
 * Caixa diario: o sistema guarda UM valor por loja + dia + tipo de venda. Linhas
 *   do arquivo com a mesma chave sao SOMADAS numa so. Se o dia ja tem valor no
 *   banco, vira "conflito": a tela escolhe pular (padrao) ou substituir.
 */
export function marcarDuplicados(tipo: TipoImportacao, linhas: LinhaValidada[], existentes: Existentes, lojaId: string | null): LinhaValidada[] {
  if (tipo === "caixa_diario") {
    const noBanco = new Map((existentes.caixa ?? []).map((c) => [chaveCaixa(c.loja_id, c), Number(c.valor)]));
    const porChave = new Map<string, LinhaValidada>();
    const saida: LinhaValidada[] = [];
    for (const l of linhas) {
      if (l.situacao === "erro" || !l.caixa) { saida.push(l); continue; }
      const k = chaveCaixa(lojaId, l.caixa);
      const ja = porChave.get(k);
      if (ja && ja.caixa) {
        ja.caixa.valor = Math.round((ja.caixa.valor + l.caixa.valor) * 100) / 100;
        ja.caixa.linhasSomadas.push(l.numero);
        ja.motivos.push(`somada com a linha ${l.numero} (mesmo dia e tipo)`);
        continue;
      }
      if (noBanco.has(k)) {
        l.situacao = "conflito";
        l.caixa.valorExistente = noBanco.get(k);
        l.motivos.push("o dia já tem valor lançado no Caixa Diário");
      }
      porChave.set(k, l);
      saida.push(l);
    }
    return saida;
  }

  const visto = new Map<string, number>();
  const noBanco = new Set<string>(
    tipo === "pagamentos"
      ? (existentes.pagamentos ?? []).map((p) => chavePagamento(p.loja_id, p))
      : (existentes.receitas ?? []).map((r) => chaveReceita(r.loja_id, r))
  );
  for (const l of linhas) {
    if (l.situacao === "erro") continue;
    const k = l.pagamento ? chavePagamento(lojaId, l.pagamento) : l.receita ? chaveReceita(lojaId, l.receita) : null;
    if (!k) continue;
    if (noBanco.has(k)) {
      l.situacao = "duplicado";
      l.motivos.push("já existe um lançamento igual no sistema");
    } else if (visto.has(k)) {
      l.situacao = "duplicado";
      l.motivos.push(`igual à linha ${visto.get(k)} do arquivo`);
    }
    if (!visto.has(k)) visto.set(k, l.numero);
  }
  return linhas;
}

/** Periodo coberto pelo arquivo (para buscar o que ja existe no banco). */
export function periodoDasLinhas(linhas: LinhaValidada[]): { ini: string; fim: string } | null {
  const datas = linhas
    .map((l) => l.pagamento?.vencimento ?? l.receita?.data ?? l.caixa?.data)
    .filter((d): d is string => !!d)
    .sort();
  return datas.length ? { ini: datas[0], fim: datas[datas.length - 1] } : null;
}

export function valorDaLinha(l: LinhaValidada): number {
  return l.pagamento?.valor ?? l.receita?.valor ?? l.caixa?.valor ?? 0;
}

/** Monta o CSV (;) das linhas rejeitadas, com o motivo, para o usuario corrigir e reimportar. */
export function csvRejeitadas(cabecalho: string[], linhas: { numero: number; original: Celula[]; motivo: string }[]): string {
  const esc = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const topo = ["Linha", ...cabecalho, "Motivo"].map(esc).join(";");
  const corpo = linhas.map((l) => [String(l.numero), ...cabecalho.map((_, i) => textoCelula(l.original[i])), l.motivo].map(esc).join(";"));
  return "﻿" + [topo, ...corpo].join("\r\n");
}

/**
 * O que vai ser gravado depois da conferencia:
 *   ok        -> sempre (salvo se o usuario desmarcar)
 *   duplicado -> so se o usuario marcar
 *   conflito  -> so com "substituir" (Caixa Diario)
 *   erro      -> nunca
 */
export function escolherParaGravar(
  linhas: LinhaValidada[],
  opcoes: { substituirConflitos: boolean; marcadas?: Set<number>; desmarcadas?: Set<number> }
): LinhaValidada[] {
  return linhas.filter((l) => {
    if (l.situacao === "erro") return false;
    if (opcoes.desmarcadas?.has(l.numero)) return false;
    if (l.situacao === "ok") return true;
    if (l.situacao === "duplicado") return !!opcoes.marcadas?.has(l.numero);
    return opcoes.substituirConflitos;
  });
}
