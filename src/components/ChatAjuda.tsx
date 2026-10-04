"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Botao "Dúvidas?" no canto da tela + janela de conversa com o assistente.
 * A conversa vive so na memoria do navegador (some ao recarregar a pagina);
 * o servidor (/api/ajuda) e quem fala com a IA.
 */

type Msg = { de: "voce" | "assistente"; texto: string; erro?: boolean };

const SUGESTOES = [
  "Paguei uma conta atrasada. Como registro?",
  "Qual a diferença entre Receitas e Caixa Diário?",
  "Por que o Painel está sem resultado?",
  "Como importo o extrato do banco?",
];

export default function ChatAjuda() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [msgs, enviando]);
  useEffect(() => {
    if (aberto) campo.current?.focus();
  }, [aberto]);

  async function enviar(pergunta: string) {
    const p = pergunta.trim();
    if (!p || enviando) return;
    const historico: Msg[] = [...msgs.filter((m) => !m.erro), { de: "voce", texto: p }];
    setMsgs((m) => [...m, { de: "voce", texto: p }]);
    setTexto("");
    setEnviando(true);
    try {
      const r = await fetch("/api/ajuda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagens: historico.map(({ de, texto }) => ({ de, texto })), tela: pathname }),
      });
      const j = (await r.json().catch(() => ({}))) as { resposta?: string; erro?: string };
      setMsgs((m) => [
        ...m,
        j.resposta
          ? { de: "assistente", texto: j.resposta }
          : { de: "assistente", texto: j.erro ?? "Não consegui responder agora. Tente de novo.", erro: true },
      ]);
    } catch {
      setMsgs((m) => [...m, { de: "assistente", texto: "Sem conexão com o servidor. Confira sua internet.", erro: true }]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="print:hidden">
      {aberto && (
        <div
          role="dialog"
          aria-label="Dúvidas sobre o sistema"
          className="fixed inset-x-2 bottom-20 z-40 flex max-h-[75vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 sm:inset-x-auto sm:right-5 sm:w-[380px]"
          onKeyDown={(e) => e.key === "Escape" && setAberto(false)}
        >
          <div className="flex items-center justify-between bg-marca px-4 py-3 text-marca-contraste">
            <div>
              <p className="text-sm font-semibold">Dúvidas sobre o sistema</p>
              <p className="text-[11px] opacity-80">Pergunte como fazer qualquer coisa aqui</p>
            </div>
            <button onClick={() => setAberto(false)} className="rounded p-1 text-lg leading-none hover:bg-white/15" aria-label="Fechar">
              ×
            </button>
          </div>

          <div className="min-h-[220px] flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
            {msgs.length === 0 && (
              <div className="space-y-2">
                <p className="text-slate-600">Olá! Posso explicar como usar qualquer tela do sistema. Exemplos:</p>
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-slate-700 hover:border-marca hover:bg-marca-clara"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) =>
              m.de === "voce" ? (
                <div key={i} className="ml-8 rounded-xl rounded-br-sm bg-marca px-3 py-2 text-marca-contraste whitespace-pre-wrap">
                  {m.texto}
                </div>
              ) : (
                <div
                  key={i}
                  className={`mr-4 rounded-xl rounded-bl-sm px-3 py-2 ${m.erro ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-800"}`}
                >
                  <Formatado texto={m.texto} />
                </div>
              )
            )}
            {enviando && (
              <div className="mr-4 inline-flex gap-1 rounded-xl bg-slate-100 px-3 py-3" aria-label="Escrevendo">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
              </div>
            )}
            <div ref={fim} />
          </div>

          <form
            className="border-t border-slate-200 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar(texto);
            }}
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={campo}
                value={texto}
                onChange={(e) => setTexto(e.target.value.slice(0, 1000))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void enviar(texto);
                  }
                }}
                rows={2}
                placeholder="Escreva sua dúvida…"
                className="max-h-28 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-marca focus:outline-none"
              />
              <button
                type="submit"
                disabled={enviando || !texto.trim()}
                className="rounded-lg bg-marca px-3 py-2 text-sm font-medium text-marca-contraste disabled:opacity-40"
              >
                Enviar
              </button>
            </div>
            <p className="mt-2 text-[10.5px] leading-snug text-slate-400">
              Respostas geradas por IA (Google Gemini): podem conter erros. Não escreva senhas nem dados da empresa aqui.
            </p>
          </form>
        </div>
      )}

      <button
        data-tour="ajuda"
        onClick={() => setAberto((a) => !a)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-marca px-4 py-3 text-sm font-semibold text-marca-contraste shadow-lg hover:brightness-110"
        aria-expanded={aberto}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.2M12 16.5h.01" />
        </svg>
        {aberto ? "Fechar" : "Dúvidas?"}
      </button>
    </div>
  );
}

/** Markdown minimo e seguro (sem HTML): **negrito**, listas e paragrafos. */
function Formatado({ texto }: { texto: string }) {
  const linhas = texto.replace(/\r/g, "").split("\n");
  const blocos: React.ReactNode[] = [];
  let lista: { ordenada: boolean; itens: string[] } | null = null;
  const fecharLista = () => {
    if (!lista) return;
    const L = lista.ordenada ? "ol" : "ul";
    blocos.push(
      <L key={blocos.length} className={`${lista.ordenada ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>
        {lista.itens.map((it, i) => (
          <li key={i}>{negrito(it)}</li>
        ))}
      </L>
    );
    lista = null;
  };
  for (const l of linhas) {
    const num = l.match(/^\s*\d+[.)]\s+(.*)$/);
    const bol = l.match(/^\s*[-*•]\s+(.*)$/);
    if (num || bol) {
      const ordenada = !!num;
      if (lista && lista.ordenada !== ordenada) fecharLista();
      if (!lista) lista = { ordenada, itens: [] };
      lista.itens.push((num ?? bol)![1]);
      continue;
    }
    fecharLista();
    if (!l.trim()) continue;
    const titulo = l.match(/^#{1,4}\s+(.*)$/);
    blocos.push(
      <p key={blocos.length} className={titulo ? "font-semibold" : undefined}>
        {negrito(titulo ? titulo[1] : l)}
      </p>
    );
  }
  fecharLista();
  return <div className="space-y-2 leading-relaxed">{blocos}</div>;
}

function negrito(s: string): React.ReactNode {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    )
  );
}
