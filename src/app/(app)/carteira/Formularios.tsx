"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { salvarGestor, salvarCliente, salvarEmpresa, criarConvite, revogarConvite } from "@/lib/acoes";
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
      <button className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">
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
      <button className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">
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
      <button className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">
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
                papel === p ? "bg-emerald-50 font-medium text-emerald-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p === "gestor" ? "Gestor financeiro" : "Cliente final"}
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
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
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
          <p className="mt-1.5 text-[11px] text-emerald-800">
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
