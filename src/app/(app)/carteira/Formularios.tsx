"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  salvarGestor, salvarCliente, salvarEmpresa, criarConvite, revogarConvite,
  renomearEmpresa, alternarEmpresa,
} from "@/lib/acoes";
import { inputCls } from "@/components/ui";

type Item = { id: string; nome: string };

/** Cadastro de gestor financeiro. Só a plataforma vê este formulário. */
export function FormGestor() {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  return (
    <form
      ref={ref}
      action={async (fd) => {
        setErro(null);
        const r = await salvarGestor(fd);
        if (r.ok) { ref.current?.reset(); router.refresh(); }
        else setErro(r.erro ?? "Não foi possível salvar.");
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <input name="nome" required placeholder="Nome do gestor financeiro" className={`${inputCls} max-w-xs`} />
      <button className="rounded-lg bg-marca px-4 py-1.5 text-sm font-semibold text-white hover:bg-marca-escura">
        Adicionar gestor
      </button>
      <span className="text-xs text-slate-400">
        Depois gere um convite para dar acesso a ele.
      </span>
      {erro && <span className="text-sm text-red-600">{erro}</span>}
    </form>
  );
}

export function FormCliente({ gestorId, gestores }: { gestorId: string | null; gestores: Item[] }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  // A plataforma precisa dizer de qual carteira é o cliente; o gestor não,
  // porque só existe uma carteira possível para ele.
  const escolheCarteira = gestorId === null;
  if (escolheCarteira && gestores.length === 0) {
    return <p className="text-sm text-slate-500">Cadastre um gestor primeiro.</p>;
  }

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
      {escolheCarteira ? (
        <select name="gestor_id" required className={`${inputCls} max-w-xs`} defaultValue="">
          <option value="" disabled>Carteira de…</option>
          {gestores.map((g) => (
            <option key={g.id} value={g.id}>{g.nome}</option>
          ))}
        </select>
      ) : (
        <input type="hidden" name="gestor_id" value={gestorId} />
      )}
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
      <span className="text-xs text-slate-400">Já nasce com os 100 códigos e a loja matriz.</span>
      {erro && <span className="text-sm text-red-600">{erro}</span>}
    </form>
  );
}

/**
 * Convite de acesso. A plataforma pode convidar gestor ou cliente final;
 * o gestor só convida clientes da própria carteira.
 */
export function FormConvite({
  clientes,
  gestores,
  podeConvidarGestor,
  baseUrl,
}: {
  clientes: Item[];
  gestores: Item[];
  podeConvidarGestor: boolean;
  baseUrl: string;
}) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [papel, setPapel] = useState<"empresario" | "gestor">("empresario");
  const [erro, setErro] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const paraGestor = papel === "gestor";
  if (clientes.length === 0 && gestores.length === 0) return null;

  return (
    <div>
      {podeConvidarGestor && (
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
              {p === "gestor" ? "BPO financeiro" : "Cliente final"}
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
          <select name="gestor_id" required className={`${inputCls} max-w-xs`} defaultValue="">
            <option value="" disabled>Gestor…</option>
            {gestores.map((g) => (
              <option key={g.id} value={g.id}>{g.nome}</option>
            ))}
          </select>
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
            Convite de {paraGestor ? "gestor" : "cliente"} criado — envie este link
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
