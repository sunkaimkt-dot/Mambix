// Supabase de teste em cima do PGlite (Postgres de verdade, em memoria).
//
// Diferente do fake do Combo 2 (arrays em JS), aqui cada chamada vira SQL de
// verdade, executado como o papel "authenticated" com mambix.uid = usuario da
// vez. Ou seja: RLS, triggers (sincroniza_pago), constraints e funcoes do banco
// valem exatamente como em producao.
//
// Cobre o subconjunto da API do supabase-js que o sistema usa:
//   from(t).select("a, b, rel!inner(c, d)") / insert / upsert(onConflict) /
//   update / delete; eq, neq, gt, gte, lt, lte, ilike, in, is (inclusive em
//   coluna da tabela ligada: "pagamentos.descricao"); order, range, limit,
//   single, maybeSingle; rpc(nome, params); auth.getUser().
// Sem range(), o resultado e cortado em 1.000 linhas, como no PostgREST.

const LIMITE = 1000;

// Ligacoes conhecidas (embed do PostgREST): tabela.rel -> join
const LIGACOES = {
  "pagamento_baixas.pagamentos": { tabela: "pagamentos", fk: "pagamento_id", pk: "id" },
};

export const estado = { db: null, uid: null };

export function usarBanco(db) {
  estado.db = db;
}
export function entrarComo(uid) {
  estado.uid = uid;
}

const PARSERS = {
  1082: (v) => v, // date -> "AAAA-MM-DD" (como o PostgREST)
  1114: (v) => v,
  1184: (v) => v, // timestamptz -> texto
  1700: (v) => (v === null ? null : Number(v)), // numeric -> number
};

const q = (id) => `"${id.replace(/"/g, '""')}"`;

function partesTopo(s) {
  const out = [];
  let nivel = 0;
  let atual = "";
  for (const c of s) {
    if (c === "(") nivel++;
    if (c === ")") nivel--;
    if (c === "," && nivel === 0) { out.push(atual.trim()); atual = ""; }
    else atual += c;
  }
  if (atual.trim()) out.push(atual.trim());
  return out;
}

async function executar(sql, params) {
  const db = estado.db;
  return db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated`);
    await tx.query(`select set_config('mambix.uid', $1, true)`, [estado.uid ?? ""]);
    return tx.query(sql, params, { parsers: PARSERS });
  });
}

class Consulta {
  constructor(tabela) {
    this.tabela = tabela;
    this.op = "select";
    this.cols = "*";
    this.filtros = [];
    this.params = [];
    this.ordens = [];
    this.faixa = null;
    this.lim = null;
    this.modo = "lista";
    this.dados = null;
    this.conflito = null;
    this.retorna = false;
  }
  p(v) {
    this.params.push(v);
    return `$${this.params.length}`;
  }
  select(cols = "*") {
    if (this.op === "select") this.cols = cols;
    else { this.retorna = true; this.cols = cols; }
    return this;
  }
  insert(dados) { this.op = "insert"; this.dados = Array.isArray(dados) ? dados : [dados]; return this; }
  upsert(dados, opts = {}) {
    this.op = "upsert";
    this.dados = Array.isArray(dados) ? dados : [dados];
    this.conflito = opts.onConflict;
    return this;
  }
  update(dados) { this.op = "update"; this.dados = dados; return this; }
  delete() { this.op = "delete"; return this; }

  col(c) {
    if (c.includes(".")) {
      const [rel, k] = c.split(".");
      return `${q("_" + rel)}.${q(k)}`;
    }
    return `t.${q(c)}`;
  }
  filtro(c, op, v) { this.filtros.push({ c, op, v }); return this; }
  eq(c, v) { return this.filtro(c, "eq", v); }
  neq(c, v) { return this.filtro(c, "neq", v); }
  gt(c, v) { return this.filtro(c, "gt", v); }
  gte(c, v) { return this.filtro(c, "gte", v); }
  lt(c, v) { return this.filtro(c, "lt", v); }
  lte(c, v) { return this.filtro(c, "lte", v); }
  ilike(c, v) { return this.filtro(c, "ilike", v); }
  in(c, v) { return this.filtro(c, "in", v); }
  is(c, v) { return this.filtro(c, "is", v); }
  order(c, opts = {}) { this.ordens.push(`${this.col(c)} ${opts.ascending === false ? "desc" : "asc"}`); return this; }
  range(de, ate) { this.faixa = [de, ate]; return this; }
  limit(n) { this.lim = n; return this; }
  single() { this.modo = "single"; return this; }
  maybeSingle() { this.modo = "maybe"; return this; }

  where() {
    if (!this.filtros.length) return "";
    const partes = this.filtros.map(({ c, op, v }) => {
      const col = this.col(c);
      if (op === "eq") return v === null ? `${col} is null` : `${col} = ${this.p(v)}`;
      if (op === "neq") return `${col} <> ${this.p(v)}`;
      if (op === "is") return `${col} is ${v === null ? "null" : v ? "true" : "false"}`;
      if (op === "in") return `${col}::text = any(${this.p(v.map(String))}::text[])`;
      const sqlOp = { gt: ">", gte: ">=", lt: "<", lte: "<=", ilike: "ilike" }[op];
      return `${col} ${sqlOp} ${this.p(v)}`;
    });
    return ` where ${partes.join(" and ")}`;
  }

  /** Lista de colunas + joins do select (com embeds). */
  projecao() {
    const cols = [];
    const joins = [];
    for (const item of partesTopo(this.cols)) {
      const m = item.match(/^(\w+)(!inner)?\((.*)\)$/s);
      if (m) {
        const lig = LIGACOES[`${this.tabela}.${m[1]}`];
        if (!lig) throw new Error(`ligacao desconhecida no teste: ${this.tabela}.${m[1]}`);
        const alias = q("_" + m[1]);
        joins.push(`${m[2] ? "join" : "left join"} ${q(lig.tabela)} ${alias} on ${alias}.${q(lig.pk)} = t.${q(lig.fk)}`);
        const campos = partesTopo(m[3]).map((k) => `'${k}', ${alias}.${q(k)}`).join(", ");
        cols.push(`case when ${alias}.${q(lig.pk)} is null then null else json_build_object(${campos}) end as ${q(m[1])}`);
      } else if (item === "*") cols.push("t.*");
      else cols.push(`t.${q(item)}`);
    }
    return { cols: cols.join(", "), joins: joins.join(" ") };
  }

  montar() {
    const t = q(this.tabela);
    if (this.op === "select") {
      const { cols, joins } = this.projecao();
      let sql = `select ${cols} from ${t} t ${joins}${this.where()}`;
      if (this.ordens.length) sql += ` order by ${this.ordens.join(", ")}`;
      if (this.faixa) sql += ` limit ${this.faixa[1] - this.faixa[0] + 1} offset ${this.faixa[0]}`;
      else sql += ` limit ${this.lim ?? LIMITE}`;
      return sql;
    }
    const ret = this.retorna ? ` returning ${partesTopo(this.cols).map((c) => (c === "*" ? "*" : q(c))).join(", ")}` : "";
    if (this.op === "insert" || this.op === "upsert") {
      const chaves = [...new Set(this.dados.flatMap((d) => Object.keys(d)))];
      const valores = this.dados
        .map((d) => `(${chaves.map((k) => (d[k] === undefined ? "default" : this.p(d[k]))).join(", ")})`)
        .join(", ");
      let sql = `insert into ${t} as t (${chaves.map(q).join(", ")}) values ${valores}`;
      if (this.op === "upsert") {
        const alvo = this.conflito.split(",").map((s) => q(s.trim()));
        sql += ` on conflict (${alvo.join(", ")}) do update set ${chaves.map((k) => `${q(k)} = excluded.${q(k)}`).join(", ")}`;
      }
      return sql + ret;
    }
    if (this.op === "update") {
      const sets = Object.entries(this.dados).map(([k, v]) => `${q(k)} = ${this.p(v)}`).join(", ");
      return `update ${t} as t set ${sets}${this.where()}${ret}`;
    }
    if (this.op === "delete") return `delete from ${t} as t${this.where()}${ret}`;
    throw new Error("operacao desconhecida");
  }

  async rodar() {
    let res;
    try {
      res = await executar(this.montar(), this.params);
    } catch (e) {
      return { data: null, error: { message: e.message, code: e.code } };
    }
    const linhas = res.rows ?? [];
    if (this.op !== "select" && !this.retorna) return { data: null, error: null };
    if (this.modo === "single") {
      if (linhas.length !== 1) return { data: null, error: { message: `JSON object requested, multiple (or no) rows returned (${linhas.length})` } };
      return { data: linhas[0], error: null };
    }
    if (this.modo === "maybe") {
      if (linhas.length > 1) return { data: null, error: { message: "JSON object requested, multiple rows returned" } };
      return { data: linhas[0] ?? null, error: null };
    }
    return { data: linhas, error: null };
  }
  then(ok, falha) { return this.rodar().then(ok, falha); }
}

export async function supabaseServer() {
  return {
    from: (t) => new Consulta(t),
    rpc: async (nome, params = {}) => {
      const chaves = Object.keys(params);
      const args = chaves.map((k, i) => `${q(k)} => $${i + 1}`).join(", ");
      try {
        const r = await executar(`select * from ${q(nome)}(${args})`, chaves.map((k) => params[k]));
        return { data: r.rows?.[0] ?? null, error: null };
      } catch (e) {
        return { data: null, error: { message: e.message } };
      }
    },
    auth: { getUser: async () => ({ data: { user: estado.uid ? { id: estado.uid } : null } }) },
  };
}
