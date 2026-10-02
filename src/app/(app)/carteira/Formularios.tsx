"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  salvarCliente, salvarClienteCompleto, salvarEmpresa, criarConvite, revogarConvite,
  renomearEmpresa, alternarEmpresa, trocarFuncao,
} from "@/lib/acoes";
import { inputCls } from "@/components/ui";

type Item = { id: string; nome: string };

/**
 * Cadastro de cliente novo em um passo so: nome do cliente, nome/CNPJ da
 * empresa (matriz) e o e-mail de quem vai acessar. De um clique so cria o
 * cliente, a empresa e o convite, e ja mostra o link pronto pra copiar.
 *
 * Cobre o caso comum -- cliente com uma empresa so. Quem precisa de mais de
 * uma empresa no mesmo cliente, ou reconvidar/trocar o e-mail depois, usa os
 * formularios "Mais uma empresa" e "Dar acesso" logo abaixo.
 */
export function FormClienteCompleto() {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div>
      <form
        ref={ref}
        action={async (fd) => {
          setErro(null);
          setLink(null);
          setCopiado(false);
          const r = await salvarClienteCompleto(fd);
          if (r.ok && r.token) {
            setLink(`${baseUrl}/convite/${r.token}`);
            ref.current?.reset();
            router.refresh();
          } else setErro(r.erro ?? "Não foi possível salvar.");
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <input name="nome_cliente" required placeholder="Nome do cliente" className={`${inputCls} max-w-xs`} />
        <input name="nome_empresa" required placeholder="Nome da empresa (CNPJ)" className={`${inputCls} max-w-xs`} />
        <input
          name="email"
          type="email"
          required
          placeholder="e-mail de quem vai acessar"
          className={`${inputCls} max-w-xs`}
        />
        <button className="rounded-lg bg-marca px-4 py-1.5 text-sm font-semibold text-white hover:bg-marca-escura">
          Cadastrar cliente
        </button>
        {erro && <span className="text-sm text-red-600">{erro}</span>}
      </form>
      <p className="mt-2 text-xs text-slate-400">
        Já nasce com os 100 códigos, a loja matriz e os bancos mais comuns, e o convite de acesso pronto pra enviar.
      </p>

      {link && (
        <div className="mt-3 rounded-lg border border-marca-clara bg-marca-clara p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-marca-escura">
            Cliente cadastrado — envie este link de acesso
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-white px-2 py-1 text-xs text-slate-700">{link}</code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(link);
                setCopiado(true);
              }}
              className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-marca-escura">
            Vale 7 dias e só funciona para esse e-mail. Quem se cadastrar sem convite não vê nada.
          </p>
        </div>
      )}
    </div>
  );
}

export function FormCliente() {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  return (
    <form
      ref={ref}
      action={async (fd) => {
        setErro(null);
        const r = await salvarCliente(fd);
        if (r.ok) { ref.current?.reset(); router.refresh(); }
        else setErro(r.erro ?? "Não foi possível salvar.");
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <input name="nome" required placeholder="Nome do cliente" className={`${inputCls} max-w-xs`} />
      <button className="rounded-lg bg-marca px-4 py-1.5 text-sm font-semibold text-white hover:bg-marca-escura">
        Adicionar cliente
      </button>
      {erro && <span className="text-sm text-red-600">{erro}</span>}
    </form>
  );
}

export function FormEmpresa({ clientes }: { clientes: Item[] }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (clientes.length === 0) return null;

  return (
    <form
      ref={ref}
      action={async (fd) => {
        setErro(null);
        const r = await salvarEmpresa(fd);
        if (r.ok) { ref.current?.reset(); router.refresh(); }
        else setErro(r.erro ?? "Não foi possível salvar.");
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <input name="nome" required placeholder="Nome da empresa (CNPJ)" className={`${inputCls} max-w-xs`} />
      <select name="cliente_id" required className={`${inputCls} max-w-xs`} defaultValue="">
        <option value="" disabled>Cliente…</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>{c.nome}</option>
        ))}
      </select>
      <button className="rounded-lg bg-marca px-4 py-1.5 text-sm font-semibold text-white hover:bg-marca-escura">
        Adicionar empresa
      </button>
      <span className="text-xs text-slate-400">Já nasce com os 100 códigos, a loja matriz e os bancos mais comuns.</span>
      {erro && <span className="text-sm text-red-600">{erro}</span>}
    </form>
  );
}

/**
 * Convite de acesso: para um cliente (vê e lança na empresa dele) ou para
 * alguém da equipe da Mambix (com a função escolhida).
 */
export function FormConvite({ clientes, baseUrl }: { clientes: Item[]; baseUrl: string }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [papel, setPapel] = useState<"empresario" | "gestor">("empresario");
  const [erro, setErro] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const paraGestor = papel === "gestor";
  return (
    <div>
      {(
        <div className="mb-3 flex gap-1.5">
          {(["empresario", "gestor"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setPapel(p); setLink(null); setErro(null); }}
              className={`rounded-lg px-3 py-1 text-sm ${
                papel === p ? "bg-marca-clara font-medium text-marca" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p === "gestor" ? "Equipe Mambix" : "Cliente"}
            </button>
          ))}
        </div>
      )}

      <form
        ref={ref}
        action={async (fd) => {
          setErro(null);
          setLink(null);
          setCopiado(false);
          const r = await criarConvite(fd);
          if (r.ok && r.token) {
            setLink(`${baseUrl}/convite/${r.token}`);
            ref.current?.reset();
            router.refresh();
          } else setErro(r.erro ?? "Não foi possível criar o convite.");
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="papel" value={papel} />
        <input
          name="email"
          type="email"
          required
          placeholder="e-mail de quem vai acessar"
          className={`${inputCls} max-w-xs`}
        />

        {paraGestor ? (
          <>
            {/* Quem nao escolher entra como operador -- e o banco que garante. */}
            <select name="funcao" className={`${inputCls} max-w-[190px]`} defaultValue="operador">
              <option value="admin">Administrador — faz tudo</option>
              <option value="operador">Operador — lança e dá baixa</option>
              <option value="consulta">Consulta — só lê</option>
            </select>
          </>
        ) : clientes.length === 0 ? (
          <span className="text-sm text-slate-500">Cadastre um cliente primeiro.</span>
        ) : (
          <select name="cliente_id" required className={`${inputCls} max-w-xs`} defaultValue="">
            <option value="" disabled>Cliente…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        )}

        <button className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-900">
          Gerar convite
        </button>
        {erro && <span className="text-sm text-red-600">{erro}</span>}
      </form>

      {link && (
        <div className="mt-3 rounded-lg border border-marca-clara bg-marca-clara p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-marca-escura">
            Convite {paraGestor ? "da equipe" : "de cliente"} criado — envie este link
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-white px-2 py-1 text-xs text-slate-700">{link}</code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(link);
                setCopiado(true);
              }}
              className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-marca-escura">
            Vale 7 dias e só funciona para esse e-mail. Quem se cadastrar sem convite não vê nada.
          </p>
        </div>
      )}
    </div>
  );
}

export function BotaoRevogar({ id }: { id: string }) {
  const router = useRouter();
  const [indo, setIndo] = useState(false);
  return (
    <button
      type="button"
      disabled={indo}
      onClick={async () => {
        setIndo(true);
        await revogarConvite(id);
        setIndo(false);
        router.refresh();
      }}
      className="text-[11px] font-medium text-red-600 hover:underline disabled:opacity-50"
    >
      revogar
    </button>
  );
}


/**
 * Empresa na lista da carteira: clica no nome para renomear, e o interruptor
 * liga ou desliga.
 *
 * Desligar nao apaga nada -- a empresa some do seletor e o historico continua no
 * banco. Empresa com anos de lancamento nao deveria ter botao de excluir.
 */
export function EmpresaChip({ id, nome, ativa }: { id: string; nome: string; ativa: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(nome);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gravar() {
    const limpo = valor.trim();
    if (!limpo || limpo === nome) { setEditando(false); setValor(nome); return; }
    setOcupado(true);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("nome", limpo);
    const r = await renomearEmpresa(fd);
    setOcupado(false);
    if (!r.ok) { setErro(r.erro ?? "Não foi possível renomear."); setValor(nome); }
    setEditando(false);
    router.refresh();
  }

  async function alternar() {
    setOcupado(true);
    const r = await alternarEmpresa(id, !ativa);
    setOcupado(false);
    if (!r.ok) setErro(r.erro ?? "Não foi possível alterar.");
    router.refresh();
  }

  if (editando) {
    return (
      <input
        autoFocus
        value={valor}
        disabled={ocupado}
        onChange={(e) => setValor(e.target.value)}
        onBlur={gravar}
        onKeyDown={(e) => {
          if (e.key === "Enter") gravar();
          if (e.key === "Escape") { setValor(nome); setEditando(false); }
        }}
        className="rounded-md border border-slate-300 px-2 py-0.5 text-xs outline-none focus:border-marca"
      />
    );
  }

  return (
    <span
      className={`group inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
        ativa ? "bg-slate-100 text-slate-600" : "bg-slate-50 text-slate-400 line-through"
      }`}
    >
      <button onClick={() => setEditando(true)} className="hover:underline" title="Clique para renomear">
        {nome}
      </button>
      <button
        onClick={alternar}
        disabled={ocupado}
        title={ativa ? "Desligar (some do seletor, histórico fica)" : "Religar"}
        className="text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-slate-700 disabled:opacity-40"
      >
        {ativa ? "×" : "↺"}
      </button>
      {erro && <span className="text-red-600">{erro}</span>}
    </span>
  );
}


const NOMES_DE_FUNCAO = {
  admin: "Administrador",
  operador: "Operador",
  consulta: "Consulta",
} as const;

const DESCRICAO_DA_FUNCAO = {
  admin: "cadastra clientes e empresas, convida pessoas e edita a marca",
  operador: "lança, edita e dá baixa; não cadastra nem convida",
  consulta: "só lê relatórios",
} as const;

/**
 * Linha de uma pessoa da equipe da Mambix, com a função dela.
 *
 * O admin troca a função aqui mesmo. Ele nao aparece para si proprio com o
 * seletor habilitado: quem muda o proprio nivel de acesso pode se promover, e o
 * banco recusa de qualquer forma -- a tela so evita a frustacao do clique.
 */
export function LinhaDaEquipe({
  userId,
  nome,
  funcao,
  souEu,
  podeEditar,
}: {
  userId: string;
  nome: string;
  funcao: "admin" | "operador" | "consulta";
  souEu: boolean;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(funcao);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function trocar(nova: "admin" | "operador" | "consulta") {
    const anterior = valor;
    setValor(nova);
    setSalvando(true);
    setErro(null);
    const r = await trocarFuncao(userId, nova);
    setSalvando(false);
    if (!r.ok) { setValor(anterior); setErro(r.erro ?? "Não foi possível alterar."); return; }
    router.refresh();
  }

  return (
    <li className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
      <span className="font-medium">{nome}</span>
      {souEu && <span className="text-[11px] uppercase tracking-wide text-slate-400">você</span>}

      {podeEditar && !souEu ? (
        <select
          value={valor}
          disabled={salvando}
          onChange={(e) => trocar(e.target.value as "admin" | "operador" | "consulta")}
          className={`${inputCls} ml-auto max-w-[190px]`}
        >
          <option value="admin">Administrador</option>
          <option value="operador">Operador</option>
          <option value="consulta">Consulta</option>
        </select>
      ) : (
        <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {NOMES_DE_FUNCAO[valor]}
        </span>
      )}

      <span className="w-full text-[11px] text-slate-400">{DESCRICAO_DA_FUNCAO[valor]}</span>
      {erro && <span className="w-full text-xs text-red-600">{erro}</span>}
    </li>
  );
}
