import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import {
  montarInstrucoes,
  telaAtual,
  LIMITE_POR_DIA,
  LIMITE_POR_HORA,
  MAX_HISTORICO,
  MAX_PERGUNTA,
  type Papel,
} from "@/lib/ajuda-prompt";

/**
 * Chat "Dúvidas?": recebe a conversa, manda para o Gemini com o manual do
 * sistema e devolve a resposta.
 *
 * - So para quem esta logado; o manual enviado depende do papel da pessoa.
 * - A IA nao recebe nenhum dado financeiro da empresa.
 * - Limite por pessoa (hora e dia), contado na tabela ajuda_perguntas.
 * - Chave e modelo: variaveis GEMINI_API_KEY e GEMINI_MODEL (Vercel).
 */

export const runtime = "nodejs";
export const maxDuration = 30;

type Msg = { de: "voce" | "assistente"; texto: string };

/** Ordem de tentativa (rapidos e baratos primeiro). GEMINI_MODEL, se houver, vem antes. */
const MODELOS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.8-flash"];

function falha(status: number, erro: string) {
  return NextResponse.json({ erro }, { status });
}

export async function POST(req: Request) {
  const chave = process.env.GEMINI_API_KEY;
  if (!chave) return falha(503, "O assistente ainda não foi configurado. Fale com a Mambix.");

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return falha(401, "Sua sessão expirou. Entre de novo no sistema.");

  // ---- entrada
  let corpo: { mensagens?: unknown; tela?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return falha(400, "Mensagem inválida.");
  }
  const mensagens = (Array.isArray(corpo.mensagens) ? corpo.mensagens : [])
    .filter(
      (m): m is Msg =>
        !!m &&
        typeof m === "object" &&
        ((m as Msg).de === "voce" || (m as Msg).de === "assistente") &&
        typeof (m as Msg).texto === "string"
    )
    .slice(-MAX_HISTORICO)
    .map((m) => ({ de: m.de, texto: m.texto.slice(0, m.de === "voce" ? MAX_PERGUNTA : 4000) }));
  const ultima = mensagens[mensagens.length - 1];
  if (!ultima || ultima.de !== "voce" || !ultima.texto.trim()) return falha(400, "Escreva sua dúvida.");
  const pathname = typeof corpo.tela === "string" ? corpo.tela.slice(0, 200) : "/";

  // ---- limite por pessoa
  const agora = Date.now();
  const [hora, dia] = await Promise.all([
    supabase
      .from("ajuda_perguntas")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("criado_em", new Date(agora - 3600_000).toISOString()),
    supabase
      .from("ajuda_perguntas")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("criado_em", new Date(agora - 86400_000).toISOString()),
  ]);
  if ((hora.count ?? 0) >= LIMITE_POR_HORA || (dia.count ?? 0) >= LIMITE_POR_DIA)
    return falha(429, "Você atingiu o limite de perguntas por agora. Tente de novo mais tarde ou fale com a Mambix.");

  const { data: perfil } = await supabase.from("perfis").select("papel").eq("user_id", user.id).maybeSingle();
  const papel = ((perfil?.papel as Papel) ?? "empresario") as Papel;

  // ---- Gemini
  // A conversa precisa comecar pela pessoa (o Gemini exige isso).
  const inicio = mensagens.findIndex((m) => m.de === "voce");
  const contents = mensagens.slice(inicio).map((m) => ({
    role: m.de === "voce" ? "user" : "model",
    parts: [{ text: m.texto }],
  }));

  // Tenta os modelos em ordem: o plano gratuito nao libera todos, e cada um
  // tem a propria cota. O primeiro que responder vence (fica no log).
  const modelos = Array.from(new Set([process.env.GEMINI_MODEL, ...MODELOS].filter(Boolean))) as string[];
  const base = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com"; // BASE_URL so p/ teste local
  const corpoIA = JSON.stringify({
    systemInstruction: { parts: [{ text: montarInstrucoes(papel, pathname) }] },
    contents,
    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
  });
  const prazo = Date.now() + 26_000;
  let resposta = "";
  let ultimoStatus = 0;
  for (const modelo of modelos) {
    const resta = prazo - Date.now();
    if (resta < 3_000) break;
    try {
      const r = await fetch(`${base}/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
        body: corpoIA,
        signal: AbortSignal.timeout(Math.min(15_000, resta)),
      });
      ultimoStatus = r.status;
      if (!r.ok) {
        console.error(`ajuda: ${modelo} respondeu ${r.status}`, (await r.text()).slice(0, 300));
        // Chave invalida: nao adianta trocar de modelo.
        if (r.status === 401) break;
        continue;
      }
      const j = (await r.json()) as {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
      };
      resposta = (j.candidates?.[0]?.content?.parts ?? [])
        .filter((p) => !p.thought && typeof p.text === "string")
        .map((p) => p.text)
        .join("")
        .trim();
      console.log(`ajuda: respondido por ${modelo}`);
      break;
    } catch (e) {
      ultimoStatus = 504;
      console.error(`ajuda: falha ao chamar ${modelo}`, e);
    }
  }
  if (!resposta && ultimoStatus !== 200) {
    if (ultimoStatus === 429)
      return falha(429, "O assistente está muito requisitado agora. Tente de novo em alguns minutos.");
    return falha(502, "O assistente não conseguiu responder agora. Tente de novo em instantes.");
  }
  if (!resposta) resposta = "Não consegui responder essa. Tente perguntar de outro jeito ou fale com a Mambix.";

  // Registro (limite de uso + Mambix ver o que os clientes perguntam).
  // Falhar aqui nao impede a resposta.
  const { error } = await supabase.from("ajuda_perguntas").insert({
    tela: telaAtual(pathname).chave,
    pergunta: ultima.texto.trim().slice(0, MAX_PERGUNTA),
    resposta: resposta.slice(0, 8000),
  });
  if (error) console.error("ajuda: nao registrou a pergunta", error.message);

  return NextResponse.json({ resposta });
}
