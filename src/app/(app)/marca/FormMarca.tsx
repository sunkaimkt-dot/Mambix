"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarMarca, enviarLogo, removerLogo } from "@/lib/acoes";
import { MARCA_PADRAO, type Marca } from "@/lib/marca-comum";
import { Campo, Cartao, inputCls } from "@/components/ui";

export type Alvo = {
  nivel: "plataforma" | "gestor" | "cliente" | "empresa";
  id: string | null;
  rotulo: string;
  grupo: string;
  pai: string | null;
};

/* `cor_secundaria` existe na tabela mas nao aparece aqui de proposito: nenhuma
   parte da interface usa essa cor ainda, e campo que promete e nao cumpre e pior
   do que campo que nao existe. O tom escuro do hover sai calculado da cor
   principal, entao basta informar UMA cor e o resto se resolve. */
const CAMPOS_COR = [
  { k: "cor_primaria", rotulo: "Cor principal", ajuda: "Botões, links e o item ativo do menu." },
  { k: "cor_positivo", rotulo: "Números positivos", ajuda: "Entradas, receitas e lucro." },
  { k: "cor_negativo", rotulo: "Números negativos", ajuda: "Despesas, saídas e atrasos." },
] as const;

const vazia: Marca = {
  logo_url: null, logo_negativo_url: null, nome_exibido: null, tagline: null,
  cor_primaria: null, cor_secundaria: null, cor_positivo: null, cor_negativo: null,
};

export default function FormMarca({
  alvos,
  valores,
  logos,
}: {
  alvos: Alvo[];
  valores: Record<string, Marca>;
  logos: Record<string, string | null>;
}) {
  const router = useRouter();
  const [chaveAtual, setChaveAtual] = useState(`${alvos[0].nivel}:${alvos[0].id ?? "geral"}`);
  const [estado, setEstado] = useState<"parado" | "salvando" | "salvo">("parado");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, comecarEnvio] = useTransition();
  const arquivoRef = useRef<HTMLInputElement>(null);

  const alvo = alvos.find((a) => `${a.nivel}:${a.id ?? "geral"}` === chaveAtual)!;
  const atual = valores[chaveAtual] ?? vazia;

  // Rascunho local: o formulario e controlado para a previa reagir a cada tecla.
  const [form, setForm] = useState<Marca>(atual);
  const [chaveDoRascunho, setChaveDoRascunho] = useState(chaveAtual);
  if (chaveDoRascunho !== chaveAtual) {
    setChaveDoRascunho(chaveAtual);
    setForm(valores[chaveAtual] ?? vazia);
  }

  /* O que este nivel mostraria se todos os campos ficassem em branco.
     Sobe pelos pais que o usuario CONSEGUE enxergar; o que estiver fora do
     alcance dele termina na marca da plataforma. */
  const herdado = useMemo(() => {
    const porChave = (c: string | null): Marca | null => (c ? (valores[c] ?? vazia) : null);
    const resultado: Marca = { ...vazia };
    let pai = alvo.pai;
    const visitados = new Set<string>();
    while (pai && !visitados.has(pai)) {
      visitados.add(pai);
      const m = porChave(pai);
      if (m) {
        for (const k of Object.keys(resultado) as (keyof Marca)[]) {
          if (resultado[k] == null) resultado[k] = m[k];
        }
      }
      pai = alvos.find((a) => `${a.nivel}:${a.id ?? "geral"}` === pai)?.pai ?? null;
    }
    for (const k of Object.keys(resultado) as (keyof Marca)[]) {
      if (resultado[k] == null) resultado[k] = MARCA_PADRAO[k];
    }
    return resultado;
  }, [alvo, alvos, valores]);

  const efetivo = (k: keyof Marca) => form[k] ?? herdado[k] ?? MARCA_PADRAO[k];

  const grupos = Array.from(new Set(alvos.map((a) => a.grupo)));

  async function salvar() {
    setEstado("salvando");
    setErro(null);
    const fd = new FormData();
    fd.set("nivel", alvo.nivel);
    if (alvo.id) fd.set("id", alvo.id);
    for (const k of ["nome_exibido", "tagline", "cor_primaria", "cor_positivo", "cor_negativo"] as const) {
      if (form[k]) fd.set(k, form[k]!);
    }
    const r = await salvarMarca(fd);
    if (!r.ok) { setErro(r.erro ?? "Não foi possível salvar."); setEstado("parado"); return; }
    setEstado("salvo");
    // O layout e servidor: sem refresh a barra lateral fica com a marca antiga.
    router.refresh();
    setTimeout(() => setEstado("parado"), 2500);
  }

  function subirLogo(arquivo: File) {
    comecarEnvio(async () => {
      setErro(null);
      const fd = new FormData();
      fd.set("nivel", alvo.nivel);
      if (alvo.id) fd.set("id", alvo.id);
      fd.set("arquivo", arquivo);
      const r = await enviarLogo(fd);
      if (!r.ok) { setErro(r.erro ?? "Não foi possível enviar a logo."); return; }
      router.refresh();
    });
  }

  function tirarLogo() {
    comecarEnvio(async () => {
      const fd = new FormData();
      fd.set("nivel", alvo.nivel);
      if (alvo.id) fd.set("id", alvo.id);
      await removerLogo(fd);
      router.refresh();
    });
  }

  const logoAtual = logos[chaveAtual] ?? null;
  const logoHerdada = (() => {
    let pai = alvo.pai;
    const visitados = new Set<string>();
    while (pai && !visitados.has(pai)) {
      visitados.add(pai);
      if (logos[pai]) return logos[pai];
      pai = alvos.find((a) => `${a.nivel}:${a.id ?? "geral"}` === pai)?.pai ?? null;
    }
    return null;
  })();

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* de quem e a marca */}
      <Cartao className="h-fit p-3">
        {grupos.map((g) => (
          <div key={g} className="mb-3 last:mb-0">
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g}</p>
            <ul className="space-y-0.5">
              {alvos.filter((a) => a.grupo === g).map((a) => {
                const c = `${a.nivel}:${a.id ?? "geral"}`;
                const personalizada = !!valores[c];
                return (
                  <li key={c}>
                    <button
                      onClick={() => setChaveAtual(c)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                        c === chaveAtual ? "bg-marca-clara font-medium text-marca" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span className="truncate">{a.rotulo}</span>
                      {personalizada && (
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">própria</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </Cartao>

      <div className="space-y-4">
        <Cartao className="p-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div>
              <p className="text-sm font-semibold">{alvo.rotulo}</p>
              <p className="text-xs text-slate-500">
                {alvo.nivel === "plataforma"
                  ? "Vale para todo mundo que não personalizou nada."
                  : "Campo em branco herda do nível de cima."}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Nome exibido">
              <input
                className={inputCls}
                value={form.nome_exibido ?? ""}
                placeholder={herdado.nome_exibido ?? ""}
                onChange={(e) => setForm({ ...form, nome_exibido: e.target.value || null })}
              />
            </Campo>
            <Campo rotulo="Linha de apoio">
              <input
                className={inputCls}
                value={form.tagline ?? ""}
                placeholder={herdado.tagline ?? ""}
                onChange={(e) => setForm({ ...form, tagline: e.target.value || null })}
              />
            </Campo>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {CAMPOS_COR.map(({ k, rotulo, ajuda }) => (
              <div key={k}>
                <Campo rotulo={rotulo}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                      value={efetivo(k) ?? "#000000"}
                      onChange={(e) => setForm({ ...form, [k]: e.target.value.toUpperCase() })}
                    />
                    <input
                      className={inputCls}
                      value={form[k] ?? ""}
                      placeholder={herdado[k] ?? ""}
                      onChange={(e) => setForm({ ...form, [k]: e.target.value.toUpperCase() || null })}
                    />
                  </div>
                </Campo>
                <p className="mt-1 text-[11px] leading-tight text-slate-400">{ajuda}</p>
                {!form[k] && <p className="text-[11px] text-slate-400">herdado</p>}
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <button
              onClick={salvar}
              disabled={estado === "salvando"}
              className="rounded-lg bg-marca px-5 py-2 text-sm font-semibold text-white hover:bg-marca-escura disabled:opacity-50"
            >
              {estado === "salvando" ? "Salvando…" : "Salvar"}
            </button>
            {estado === "salvo" && <span className="text-sm font-medium text-marca">Salvo.</span>}
            {erro && <span className="text-sm text-red-600">{erro}</span>}
          </div>
        </Cartao>

        {/* logo */}
        <Cartao className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Logo</p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-44 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2">
              {logoAtual || logoHerdada ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={(logoAtual ?? logoHerdada)!} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-slate-400">sem logo</span>
              )}
            </div>
            <div className="space-y-1">
              <input
                ref={arquivoRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-marca file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-marca-escura"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) subirLogo(f);
                }}
              />
              <p className="text-[11px] text-slate-400">PNG, JPG, SVG ou WEBP, até 2 MB. Fundo transparente fica melhor.</p>
              {!logoAtual && logoHerdada && <p className="text-[11px] text-slate-400">Esta logo está sendo herdada.</p>}
              {logoAtual && (
                <button onClick={tirarLogo} disabled={enviando} className="text-[11px] font-medium text-red-600 hover:underline">
                  Remover logo deste nível
                </button>
              )}
              {enviando && <p className="text-[11px] text-slate-400">enviando…</p>}
            </div>
          </div>
        </Cartao>

        {/* previa */}
        <Cartao className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Como vai ficar</p>
          <div
            className="rounded-xl border border-slate-200 p-4"
            style={
              {
                "--marca": efetivo("cor_primaria") ?? "#047857",
                "--positivo": efetivo("cor_positivo") ?? "#047857",
                "--negativo": efetivo("cor_negativo") ?? "#DC2626",
              } as React.CSSProperties
            }
          >
            <div className="mb-3 flex items-center gap-3">
              {logoAtual || logoHerdada ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={(logoAtual ?? logoHerdada)!} alt="" className="h-8 w-auto object-contain" />
              ) : (
                <span className="text-base font-bold">{efetivo("nome_exibido")}</span>
              )}
              <span className="text-xs text-slate-500">{efetivo("tagline")}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-lg bg-marca px-4 py-1.5 text-sm font-semibold text-white">Salvar</span>
              <span className="rounded-lg bg-marca-clara px-3 py-1.5 text-sm font-medium text-marca">Menu ativo</span>
              <span className="text-sm font-bold text-positivo">R$ 12.400,00</span>
              <span className="text-sm font-bold text-negativo">R$ 3.180,00</span>
            </div>
          </div>
        </Cartao>
      </div>
    </div>
  );
}
