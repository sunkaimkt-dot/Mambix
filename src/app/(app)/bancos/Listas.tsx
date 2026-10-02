"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { salvarBanco, alternarBanco, salvarLoja } from "@/lib/acoes";
import { inputCls } from "@/components/ui";

type Banco = { id: string; nome: string; ativo: boolean };
type Loja = { id: string; nome: string; is_matriz: boolean };

/* Nome que vira campo ao clicar. Enter grava, Esc desiste. */
function NomeEditavel({ nome, aoGravar, riscado = false }: { nome: string; aoGravar: (n: string) => Promise<string | null>; riscado?: boolean }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(nome);
  const [erro, setErro] = useState<string | null>(null);

  async function gravar() {
    const limpo = valor.trim();
    setEditando(false);
    if (!limpo || limpo.toUpperCase() === nome) { setValor(nome); return; }
    const e = await aoGravar(limpo);
    if (e) { setErro(e); setValor(nome); }
  }

  if (editando) {
    return (
      <input
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={gravar}
        onKeyDown={(e) => {
          if (e.key === "Enter") gravar();
          if (e.key === "Escape") { setValor(nome); setEditando(false); }
        }}
        className={`${inputCls} max-w-xs`}
      />
    );
  }
  return (
    <span>
      <button
        type="button"
        onClick={() => { setErro(null); setEditando(true); }}
        title="Clique para renomear"
        className={`text-left hover:underline ${riscado ? "text-slate-400 line-through" : ""}`}
      >
        {nome}
      </button>
      {erro && <span className="ml-2 text-xs text-red-600">{erro}</span>}
    </span>
  );
}

function FormNovo({ placeholder, botao, aoSalvar }: { placeholder: string; botao: string; aoSalvar: (fd: FormData) => Promise<{ ok: boolean; erro?: string }> }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        setErro(null);
        const r = await aoSalvar(fd);
        if (r.ok) { ref.current?.reset(); router.refresh(); }
        else setErro(r.erro ?? "Não foi possível salvar.");
      }}
      className="mt-4 flex flex-wrap items-center gap-2"
    >
      <input name="nome" required placeholder={placeholder} className={`${inputCls} max-w-xs`} />
      <button className="rounded-lg bg-marca px-4 py-1.5 text-sm font-semibold text-white hover:bg-marca-escura">{botao}</button>
      {erro && <span className="text-sm text-red-600">{erro}</span>}
    </form>
  );
}

export function ListaBancos({ empresaId, bancos }: { empresaId: string; bancos: Banco[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);

  return (
    <div>
      {bancos.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum banco cadastrado.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {bancos.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-2">
              <NomeEditavel
                nome={b.nome}
                riscado={!b.ativo}
                aoGravar={async (nome) => {
                  const fd = new FormData();
                  fd.set("empresa_id", empresaId);
                  fd.set("id", b.id);
                  fd.set("nome", nome);
                  const r = await salvarBanco(fd);
                  router.refresh();
                  return r.ok ? null : (r.erro ?? "Não foi possível renomear.");
                }}
              />
              <button
                type="button"
                disabled={ocupado === b.id}
                onClick={async () => {
                  setOcupado(b.id);
                  await alternarBanco(b.id, !b.ativo);
                  setOcupado(null);
                  router.refresh();
                }}
                className={`ml-auto rounded-md px-2 py-0.5 text-xs ${
                  b.ativo ? "bg-marca-clara text-marca" : "bg-slate-100 text-slate-500"
                } disabled:opacity-50`}
                title={b.ativo ? "Desligar" : "Religar"}
              >
                {b.ativo ? "em uso" : "desligado"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <FormNovo
        placeholder="Novo banco ou caixa"
        botao="Adicionar"
        aoSalvar={(fd) => { fd.set("empresa_id", empresaId); return salvarBanco(fd); }}
      />
    </div>
  );
}

export function ListaLojas({ empresaId, lojas }: { empresaId: string; lojas: Loja[] }) {
  const router = useRouter();
  return (
    <div>
      <ul className="divide-y divide-slate-100 text-sm">
        {lojas.map((l) => (
          <li key={l.id} className="flex items-center gap-3 py-2">
            <NomeEditavel
              nome={l.nome}
              aoGravar={async (nome) => {
                const fd = new FormData();
                fd.set("empresa_id", empresaId);
                fd.set("id", l.id);
                fd.set("nome", nome);
                const r = await salvarLoja(fd);
                router.refresh();
                return r.ok ? null : (r.erro ?? "Não foi possível renomear.");
              }}
            />
            {l.is_matriz && (
              <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">matriz</span>
            )}
          </li>
        ))}
      </ul>
      <FormNovo
        placeholder="Nova loja (filial)"
        botao="Adicionar"
        aoSalvar={(fd) => { fd.set("empresa_id", empresaId); return salvarLoja(fd); }}
      />
    </div>
  );
}
