// Supabase falso, em memoria, so com o que relatorios.ts e
// relatorios-contabeis.ts usam: select (inclusive "tabela!inner(colunas)"),
// eq / gte / lte / ilike (tambem em coluna da tabela ligada, "pagamentos.cd"),
// order, range e maybeSingle. A semantica imita o PostgREST: !inner descarta a
// linha quando a tabela ligada nao passa no filtro, e sem range() o resultado
// e cortado em 1.000 linhas (o corte silencioso do Supabase).
export const banco = {};
const LIMITE = 1000;

// Ligacao conhecida: pagamento_baixas.pagamento_id -> pagamentos.id
const LIGACOES = { "pagamento_baixas:pagamentos": (linha) => (banco.pagamentos ?? []).find((p) => p.id === linha.pagamento_id) ?? null };

function valorDe(linha, coluna) {
  if (!coluna.includes(".")) return linha[coluna];
  const [rel, col] = coluna.split(".");
  return linha[rel] ? linha[rel][col] : undefined;
}

class Consulta {
  constructor(tabela) {
    this.tabela = tabela;
    this.filtros = [];
    this.ordem = null;
    this.faixa = null;
    this.unico = false;
    this.juncoes = [];
  }
  select(cols) {
    for (const m of cols.matchAll(/(\w+)!inner\(([^)]*)\)/g)) this.juncoes.push(m[1]);
    return this;
  }
  eq(c, v) { this.filtros.push([c, (x) => x === v]); return this; }
  gte(c, v) { this.filtros.push([c, (x) => x !== undefined && x !== null && x >= v]); return this; }
  lte(c, v) { this.filtros.push([c, (x) => x !== undefined && x !== null && x <= v]); return this; }
  ilike(c, v) {
    const re = new RegExp("^" + v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$", "i");
    this.filtros.push([c, (x) => typeof x === "string" && re.test(x)]);
    return this;
  }
  order(c) { this.ordem = c; return this; }
  range(de, ate) { this.faixa = [de, ate]; return this; }
  maybeSingle() { this.unico = true; return this; }
  executar() {
    let linhas = (banco[this.tabela] ?? []).map((l) => {
      const c = { ...l };
      for (const j of this.juncoes) c[j] = LIGACOES[`${this.tabela}:${j}`](l);
      return c;
    });
    for (const j of this.juncoes) linhas = linhas.filter((l) => l[j]);
    for (const [c, f] of this.filtros) linhas = linhas.filter((l) => f(valorDe(l, c)));
    if (this.ordem) linhas.sort((a, b) => (a[this.ordem] < b[this.ordem] ? -1 : a[this.ordem] > b[this.ordem] ? 1 : 0));
    if (this.faixa) linhas = linhas.slice(this.faixa[0], this.faixa[1] + 1);
    else linhas = linhas.slice(0, LIMITE);
    if (this.unico) return { data: linhas[0] ?? null, error: null };
    return { data: linhas, error: null };
  }
  then(ok, falha) { return Promise.resolve(this.executar()).then(ok, falha); }
}

export async function supabaseServer() {
  return {
    from: (t) => new Consulta(t),
    auth: { getUser: async () => ({ data: { user: null } }) },
  };
}
