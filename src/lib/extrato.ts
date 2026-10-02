/**
 * Extrato bancario -> lancamentos (especificacao 5.13, parte PDF).
 *
 * Parte PURA: recebe o texto ja extraido (linhas do PDF ou o conteudo do OFX)
 * e devolve data, descricao, valor e natureza (debito/credito) de cada
 * movimento, com uma classificacao SUGERIDA:
 *   - debito  -> codigo de despesa (1-100) + forma de pagamento (CP)
 *   - credito -> tipo de recebimento (1-12)
 *
 * Nada aqui grava. A tela mostra a sugestao, o usuario confere/corrige linha a
 * linha, e so entao as linhas entram no fluxo normal da importacao (mesma
 * validacao, mesma checagem de duplicado, mesmo lote com desfazer).
 *
 * Por que heuristica e nao um leitor por banco: cada banco tem um layout de
 * PDF, e eles mudam sem aviso. O leitor generico procura, em cada linha, uma
 * data e um valor em reais -- o formato que todo extrato brasileiro tem. O
 * que ele errar, o usuario corrige na revisao. Para quem quer precisao total,
 * o OFX (que todo banco exporta) e lido sem adivinhacao.
 */

export type Natureza = "debito" | "credito";

export type MovimentoExtrato = {
  data: string; // AAAA-MM-DD
  descricao: string;
  valor: number; // sempre positivo; o sinal esta em `natureza`
  natureza: Natureza;
  /** true quando o sinal foi deduzido (sem "-", D/C nem saldo para conferir). */
  naturezaIncerta?: boolean;
};

const r2 = (v: number) => Math.round(v * 100) / 100;

export function semAcento(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// ============================================================
// PDF (linhas de texto)
// ============================================================

/* Valor em reais: 1.234,56 / 1234,56 / -1.234,56 / 1.234,56- / 1.234,56 D / (1.234,56).
   Exige a virgula com 2 casas -- e isso que separa valor de numero de documento. */
const RE_VALOR = /(\(?-?\s?(?:R\$\s?)?\d{1,3}(?:\.\d{3})*,\d{2}\)?(?:\s?-)?(?:\s?[DC]\b)?)/g;
const RE_DATA_INICIO = /^(\d{2})[/.-](\d{2})(?:[/.-](\d{2,4}))?\b/;

type ValorLido = { valor: number; sinal: -1 | 1 | 0 };

function lerValor(bruto: string): ValorLido {
  let t = bruto.trim();
  let sinal: -1 | 1 | 0 = 0;
  if (/D$/.test(t)) { sinal = -1; t = t.slice(0, -1).trim(); }
  else if (/C$/.test(t)) { sinal = 1; t = t.slice(0, -1).trim(); }
  if (/^\(.*\)$/.test(t)) { sinal = -1; t = t.slice(1, -1); }
  if (t.endsWith("-")) { sinal = -1; t = t.slice(0, -1).trim(); }
  if (t.startsWith("-")) { sinal = -1; t = t.slice(1).trim(); }
  t = t.replace(/R\$\s?/, "");
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return { valor: r2(n), sinal };
}

/** Ano de referencia do extrato: a ultima data completa que aparecer no texto. */
export function anoDoExtrato(linhas: string[], padrao = new Date().getFullYear()): number {
  let ano: number | null = null;
  for (const l of linhas) {
    for (const m of Array.from(l.matchAll(/\b\d{2}[/.-]\d{2}[/.-](\d{4})\b/g))) ano = Number(m[1]);
  }
  return ano ?? padrao;
}

const PALAVRAS_CREDITO = [
  "pix recebido", "pix receb", "recebimento", "credito", "deposito", "dep dinheiro", "ted recebida",
  "doc recebido", "transf recebida", "rendimento", "estorno", "devolucao", "resgate", "liquidacao cobranca",
  "vendas", "antecipacao",
];
const PALAVRAS_DEBITO = [
  "pix enviado", "pix emitido", "pagamento", "pagto", "pgto", "compra", "tarifa", "debito", "saque",
  "ted enviada", "doc enviado", "transf enviada", "iof", "juros", "aplicacao", "boleto", "darf", "das ",
];

/* Linhas que nao sao movimento: saldos, cabecalhos e totais. */
const IGNORAR = /\b(saldo|s a l d o|total|subtotal|limite|lancamentos futuros|bloqueado|disponivel)\b/;

/**
 * Le as linhas de texto de um extrato em PDF.
 *
 * Cada linha com valor vira um movimento. A data vem do inicio da linha; se a
 * linha nao tiver data (varios bancos so escrevem a data no primeiro
 * movimento do dia), herda a da linha anterior.
 *
 * Natureza, nesta ordem de confianca:
 *   1. sinal explicito no valor ("-", "D"/"C", parenteses)
 *   2. saldo: se a linha traz valor E saldo, a variacao do saldo diz o sinal
 *   3. palavras da descricao (pix recebido, tarifa, compra...)
 *   4. sem pista: debito, marcado como incerto para a revisao destacar
 */
export function lerLinhasExtrato(linhas: string[], anoPadrao?: number): MovimentoExtrato[] {
  const ano = anoPadrao ?? anoDoExtrato(linhas);
  const out: MovimentoExtrato[] = [];
  let ultimaData: string | null = null;
  let saldoAnterior: number | null = null;

  for (const bruta of linhas) {
    const linha = bruta.replace(/\s+/g, " ").trim();
    if (!linha) continue;
    const norm = semAcento(linha);

    let resto = linha;
    const md = linha.match(RE_DATA_INICIO);
    if (md) {
      let a = md[3] ? Number(md[3]) : ano;
      if (a < 100) a += 2000;
      const d = Number(md[1]);
      const m = Number(md[2]);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        ultimaData = `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        resto = linha.slice(md[0].length).trim();
      }
    }

    const valores = Array.from(resto.matchAll(RE_VALOR)).map((x) => ({ bruto: x[1], pos: x.index ?? 0 }));
    const ehSaldo = IGNORAR.test(norm);
    if (ehSaldo) {
      // Linha de saldo atualiza a referencia para a deducao de sinal.
      if (valores.length) {
        const v = lerValor(valores[valores.length - 1].bruto);
        saldoAnterior = v.sinal === -1 ? -v.valor : v.valor;
      }
      continue;
    }
    if (!valores.length || !ultimaData) continue;

    const principal = lerValor(valores[0].bruto);
    if (!principal.valor) continue;
    const saldoDaLinha =
      valores.length >= 2
        ? (() => {
            const s = lerValor(valores[valores.length - 1].bruto);
            return s.sinal === -1 ? -s.valor : s.valor;
          })()
        : null;

    let descricao = resto.slice(0, valores[0].pos).trim();
    // Numero de documento solto no fim da descricao nao ajuda ninguem.
    descricao = descricao.replace(/\s+\d{3,}$/, "").trim() || "(sem descrição)";

    let natureza: Natureza | null = null;
    let incerta = false;
    if (principal.sinal !== 0) natureza = principal.sinal === -1 ? "debito" : "credito";
    else if (saldoDaLinha !== null && saldoAnterior !== null) {
      const delta = r2(saldoDaLinha - saldoAnterior);
      if (Math.abs(Math.abs(delta) - principal.valor) < 0.01) natureza = delta < 0 ? "debito" : "credito";
    }
    if (!natureza) {
      const d = semAcento(descricao);
      if (PALAVRAS_CREDITO.some((p) => d.includes(p))) natureza = "credito";
      else if (PALAVRAS_DEBITO.some((p) => d.includes(p))) natureza = "debito";
      else { natureza = "debito"; incerta = true; }
    }

    if (saldoDaLinha !== null) saldoAnterior = saldoDaLinha;
    else if (saldoAnterior !== null) saldoAnterior = r2(saldoAnterior + (natureza === "debito" ? -principal.valor : principal.valor));

    out.push({ data: ultimaData, descricao, valor: principal.valor, natureza, ...(incerta ? { naturezaIncerta: true } : {}) });
  }
  return out;
}

// ============================================================
// OFX
// ============================================================

function tag(bloco: string, nome: string): string | null {
  // OFX 1.x (SGML) nao fecha tag; OFX 2.x (XML) fecha. Pega ate o proximo "<".
  const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, "i"));
  return m ? m[1].trim() : null;
}

/** Le um arquivo OFX (exportacao padrao dos bancos). Sinal vem do proprio arquivo. */
export function lerOFX(texto: string): MovimentoExtrato[] {
  const out: MovimentoExtrato[] = [];
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  for (const b of blocos) {
    const bloco = b.split(/<\/STMTTRN>/i)[0];
    const dt = tag(bloco, "DTPOSTED");
    const amt = tag(bloco, "TRNAMT");
    if (!dt || !amt) continue;
    const m = dt.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) continue;
    const valor = Number(amt.replace(",", "."));
    if (!Number.isFinite(valor) || valor === 0) continue;
    const memo = tag(bloco, "MEMO");
    const nome = tag(bloco, "NAME");
    const descricao = [nome, memo].filter((x, i, a) => x && a.indexOf(x) === i).join(" - ") || "(sem descrição)";
    out.push({
      data: `${m[1]}-${m[2]}-${m[3]}`,
      descricao,
      valor: r2(Math.abs(valor)),
      natureza: valor < 0 ? "debito" : "credito",
    });
  }
  return out;
}

// ============================================================
// Classificacao sugerida
// ============================================================

/* Regras de mercado para extrato de pequena empresa. A primeira que bater
   vence, por isso as especificas vem antes das genericas. Codigo de despesa
   segue a tabela padrao (secao 3.1 da especificacao). */
const REGRAS_DESPESA: [RegExp, number][] = [
  [/\biof\b/, 76],
  [/juros.*(cheque|limite|especial)|encargos.*limite|\bjuros cheque/, 73],
  [/\bjuros\b|\bmora\b/, 72],
  [/tarifa|pacote de serv|cesta de serv|manut.*conta|anuidade/, 77],
  [/aluguel.*(maquin|pos\b|terminal)|(stone|cielo|rede|getnet|pagseguro).*aluguel/, 78],
  [/antecipa/, 75],
  [/emprestimo|financiamento|parcela.*contrato|capital de giro|amortiza/, 71],
  [/simples nacional|\bdas\b|pgdas/, 70],
  [/\bfgts\b|grf\b/, 23],
  [/\binss\b|\bgps\b/, 24],
  [/\bdarf\b|receita federal/, 68],
  [/\bdare\b|sefaz/, 67],
  [/\biss\b|issqn/, 63],
  [/\bicms\b/, 64],
  [/\biptu\b/, 32],
  [/pro.?labore/, 1],
  [/salario|folha de pag|pagto func|pagamento func|adiantamento salar/, 6],
  [/vale.?transporte|\bvt\b/, 16],
  [/rescis/, 10],
  [/ferias/, 12],
  [/13.? ?salario|decimo terceiro/, 13],
  [/plano de saude|unimed|amil|bradesco saude|sulamerica saude|hapvida/, 17],
  [/aluguel|condominio|locacao/, 31],
  [/energia|eletric|\benel\b|cemig|copel|light s|celesc|celpe|coelba|cosern|equatorial|neoenergia|cpfl|elektro|energisa|edp\b/, 34],
  [/sabesp|cedae|copasa|sanepar|embasa|compesa|casan|corsan|caesb|cagece|saneamento|\bagua\b|aguas de/, 33],
  [/\bgas\b|comgas|ultragaz|liquigas|supergasbras/, 27],
  [/internet|fibra|\bnet\b|vivo fibra|claro net|oi fibra|desktop|brisanet/, 37],
  [/\bvivo\b|\bclaro\b|\btim\b|\boi\b|telefonica|celular/, 36],
  [/contab|contador|escritorio contabil/, 39],
  [/advoca|advogad|honorarios/, 38],
  [/cartorio/, 40],
  [/correios/, 41],
  [/combust|posto|\bshell\b|ipiranga|petrobras|\bbr distrib|\bale combust/, 50],
  [/uber|\b99\s?(app|pop|tecnologia)?\b|cabify/, 29],
  [/estaciona|zona azul|estapar/, 49],
  [/pedagio|sem parar|conectcar|veloe/, 55],
  [/ipva|licenciamento|detran/, 51],
  [/seguro.*(auto|veic)/, 54],
  [/seguro/, 28],
  [/google|microsoft|adobe|amazon web|aws\b|software|sistema|assinatura|canva|dropbox|zoom/, 30],
  [/facebook|meta platforms|instagram|google ads|anuncio|marketing|publicidade/, 57],
  [/consultoria/, 58],
  [/frete|transportadora|loggi|jadlog|motoboy|lalamove/, 84],
  [/embalage|sacola/, 85],
  [/comiss/, 82],
  [/material de escritorio|papelaria|kalunga/, 44],
  [/limpeza|higiene/, 43],
  [/manutencao|reparo|conserto/, 47],
  [/retirada|distribuicao de lucro/, 99],
  [/fornecedor|mercadoria|insumo|estoque|atacad|distribuidora/, 100],
];

/* Forma de pagamento (CP), tabela 3.3. */
const REGRAS_FORMA: [RegExp, number][] = [
  [/\bpix\b/, 7],
  [/\bted\b|\bdoc\b|transf/, 7],
  [/darf|\bdas\b|\bgps\b|\bgrf\b|guia|dare|tributo|imposto/, 4],
  [/boleto|titulo|cobranca|pagto conta|pagamento de conta|conta de consumo|convenio/, 3],
  [/deb.*aut|debito automatico|tarifa|iof|juros|anuidade/, 5],
  [/saque/, 10],
  [/cartao.*credito|fatura/, 9],
  [/compra|cartao|debito\b|elo\b|visa|master/, 8],
  [/cheque/, 2],
];

/* Tipo de recebimento, tabela 3.4. */
const REGRAS_RECEBIMENTO: [RegExp, number][] = [
  [/rendimento|rend pago|juros cred|remuneracao|resgate/, 9],
  [/emprestimo|credito pessoal|capital de giro|financiamento/, 11],
  [/antecipa/, 8],
  [/(cielo|rede|redecard|stone|getnet|pagseguro|pagbank|sumup|safrapay|vero|mercado ?pago|ton\b|infinitepay|cappta|adiq|bin\b).*(deb|debito)|(deb|debito).*(cielo|rede|stone|getnet|pagseguro)/, 2],
  [/cielo|rede|redecard|stone|getnet|pagseguro|pagbank|sumup|safrapay|vero|mercado ?pago|\bton\b|infinitepay|cappta|adiq|vendas cartao|credito cartao/, 3],
  [/alelo|sodexo|pluxee|ticket|vr benef|ben visa|vale.?refei|vale.?alim/, 4],
  [/boleto|cobranca|liquidacao/, 5],
  [/cheque/, 6],
  [/\bpix\b|\bted\b|\bdoc\b|transf|deposito/, 7],
  [/socio|aporte/, 10],
];

export function sugerirDespesa(descricao: string): { codigo: number | null; forma: number | null } {
  const d = semAcento(descricao);
  const codigo = REGRAS_DESPESA.find(([re]) => re.test(d))?.[1] ?? null;
  const forma = REGRAS_FORMA.find(([re]) => re.test(d))?.[1] ?? null;
  return { codigo, forma };
}

export function sugerirRecebimento(descricao: string): number {
  const d = semAcento(descricao);
  // "dinheiro"/"especie" vem antes do resto: deposito em especie e dinheiro.
  if (/dinheiro|especie/.test(d)) return 1;
  return REGRAS_RECEBIMENTO.find(([re]) => re.test(d))?.[1] ?? 12;
}

// ============================================================
// Revisao -> abas no formato da importacao
// ============================================================

export type LinhaRevisao = MovimentoExtrato & {
  incluir: boolean;
  codigo: number | null; // debito: codigo de despesa
  forma: number | null; // debito: CP
  tipo: number | null; // credito: tipo de recebimento
};

export function prepararRevisao(movs: MovimentoExtrato[]): LinhaRevisao[] {
  return movs.map((m) => {
    const desp = sugerirDespesa(m.descricao);
    return {
      ...m,
      incluir: true,
      codigo: m.natureza === "debito" ? desp.codigo : null,
      forma: m.natureza === "debito" ? desp.forma : null,
      tipo: m.natureza === "credito" ? sugerirRecebimento(m.descricao) : null,
    };
  });
}

const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const valorBR = (v: number) => v.toFixed(2).replace(".", ",");

/**
 * Transforma a revisao em duas "abas" com cabecalhos que o mapeamento
 * automatico ja reconhece. Debito de extrato e conta JA PAGA: vencimento e
 * data de pagamento sao o dia do debito.
 */
export function revisaoParaAbas(linhas: LinhaRevisao[]): { nome: string; dados: (string | null)[][] }[] {
  const incl = linhas.filter((l) => l.incluir);
  const deb = incl.filter((l) => l.natureza === "debito");
  const cred = incl.filter((l) => l.natureza === "credito");
  return [
    {
      nome: "Pagamentos (débitos do extrato)",
      dados: [
        ["Vencimento", "Data de pagamento", "Código da despesa", "Descrição", "Valor", "Forma de pagamento"],
        ...deb.map((l) => [dataBR(l.data), dataBR(l.data), l.codigo ? String(l.codigo) : "", l.descricao, valorBR(l.valor), l.forma ? String(l.forma) : ""]),
      ],
    },
    {
      nome: "Receitas (créditos do extrato)",
      dados: [
        ["Data", "Tipo de recebimento", "Descrição", "Valor"],
        ...cred.map((l) => [dataBR(l.data), l.tipo ? String(l.tipo) : "", l.descricao, valorBR(l.valor)]),
      ],
    },
  ];
}
