"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase-server";
import { detalhesCodigo, type LinhaDetalhe, type FiltroRelatorio } from "@/lib/relatorios";

export type Resultado = { ok: boolean; erro?: string };

/**
 * Busca a composicao de um codigo sob demanda, quando o usuario abre o modal.
 * Carregar isso junto com o relatorio significaria trazer os lancamentos dos 100
 * codigos de uma vez, para o caso de ele abrir um.
 */
export async function buscarDetalhes(
  empresaId: string,
  codigo: number,
  ano: number,
  mes: number,
  regime: "competencia" | "caixa",
  lojaId: string | null,
  filtro: FiltroRelatorio = {}
): Promise<LinhaDetalhe[]> {
  return detalhesCodigo(empresaId, codigo, ano, mes, regime, lojaId, filtro);
}

function texto(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function numero(fd: FormData, k: string) {
  const v = texto(fd, k);
  if (v === null) return null;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}
function amigavel(msg: string) {
  if (msg.includes("row-level security")) {
    return "Você não tem permissão para gravar nesta empresa. Fale com o consultor responsável.";
  }
  if (msg.includes("violates not-null")) return "Preencha todos os campos obrigatórios.";
  if (msg.includes("duplicate key")) return "Este lançamento já existe.";
  return msg;
}

export async function salvarPagamento(fd: FormData): Promise<Resultado> {
  const valor = numero(fd, "valor");
  const cd = Number(fd.get("cd"));
  if (valor === null || valor === 0) return { ok: false, erro: "Informe um valor válido." };
  if (!cd) return { ok: false, erro: "Selecione o código da despesa." };

  const supabase = await supabaseServer();
  const empresaId = texto(fd, "empresa_id")!;
  const vencimento = texto(fd, "vencimento")!;

  const { data: criado, error } = await supabase
    .from("pagamentos")
    .insert({
      empresa_id: empresaId,
      loja_id: texto(fd, "loja_id"),
      vencimento,
      cfc: Number(fd.get("cfc")),
      cd,
      descricao: texto(fd, "descricao") ?? "",
      comp_mes: Number(fd.get("comp_mes")),
      comp_ano: Number(fd.get("comp_ano")),
      valor,
      banco_id: texto(fd, "banco_id"),
      cp: fd.get("cp") ? Number(fd.get("cp")) : null,
      cod_familia: fd.get("cod_familia") ? Number(fd.get("cod_familia")) : null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, erro: amigavel(error.message) };

  // "Ja pago" no formulario e um atalho: registra a baixa integral na data
  // informada. O campo pago nunca e gravado direto -- ele deriva das baixas.
  if (fd.get("ja_pago") === "on" && criado) {
    const dataPag = texto(fd, "data_pagamento") ?? vencimento;
    const { error: e2 } = await supabase.from("pagamento_baixas").insert({
      empresa_id: empresaId,
      pagamento_id: criado.id,
      data_pagamento: dataPag,
      valor,
      banco_id: texto(fd, "banco_id"),
      cp: fd.get("cp") ? Number(fd.get("cp")) : null,
    });
    if (e2) return { ok: false, erro: amigavel(e2.message) };
  }

  revalidatePath("/pagamentos");
  revalidatePath("/em-aberto");
  return { ok: true };
}

/**
 * Registra uma saida de dinheiro. Aceita valor menor que o saldo (pagamento
 * parcial) e data em mes diferente do vencimento (conta atrasada).
 * Nao cria lancamento novo -- e por isso que pagar em julho o aluguel de junho
 * nao duplica a DRE de junho.
 */
export async function registrarBaixa(fd: FormData): Promise<Resultado> {
  const pagamentoId = texto(fd, "pagamento_id");
  const dataPagamento = texto(fd, "data_pagamento");
  const valor = numero(fd, "valor");

  if (!pagamentoId) return { ok: false, erro: "Lançamento não identificado." };
  if (!dataPagamento) return { ok: false, erro: "Informe a data em que o pagamento saiu." };
  if (valor === null || valor <= 0) return { ok: false, erro: "Informe um valor válido." };

  const supabase = await supabaseServer();
  const { data: pag, error: erroBusca } = await supabase
    .from("pagamentos_saldo")
    .select("empresa_id, saldo")
    .eq("id", pagamentoId)
    .maybeSingle();
  if (erroBusca) return { ok: false, erro: amigavel(erroBusca.message) };
  if (!pag) return { ok: false, erro: "Lançamento não encontrado." };

  if (valor > Number(pag.saldo) + 0.01) {
    return { ok: false, erro: `O valor excede o saldo em aberto (${Number(pag.saldo).toFixed(2)}).` };
  }

  const { error } = await supabase.from("pagamento_baixas").insert({
    empresa_id: pag.empresa_id,
    pagamento_id: pagamentoId,
    data_pagamento: dataPagamento,
    valor,
    banco_id: texto(fd, "banco_id"),
    cp: fd.get("cp") ? Number(fd.get("cp")) : null,
  });
  if (error) return { ok: false, erro: amigavel(error.message) };

  revalidatePath("/pagamentos");
  revalidatePath("/em-aberto");
  revalidatePath("/dfc");
  return { ok: true };
}

/** Desfaz uma baixa. A conta volta a ficar em aberto pelo valor estornado. */
export async function estornarBaixa(id: string): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("pagamento_baixas").delete().eq("id", id);
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/pagamentos");
  revalidatePath("/em-aberto");
  revalidatePath("/dfc");
  return { ok: true };
}

export async function salvarReceita(fd: FormData): Promise<Resultado> {
  const valor = numero(fd, "valor");
  if (valor === null || valor === 0) return { ok: false, erro: "Informe um valor válido." };

  const supabase = await supabaseServer();
  const { error } = await supabase.from("receitas").insert({
    empresa_id: texto(fd, "empresa_id")!,
    loja_id: texto(fd, "loja_id"),
    data: texto(fd, "data")!,
    descricao: texto(fd, "descricao") ?? "",
    valor,
    banco_id: texto(fd, "banco_id"),
    tipo_recebimento: Number(fd.get("tipo_recebimento")),
  });
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/receitas");
  return { ok: true };
}

export async function salvarCaixa(fd: FormData): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("caixa_diario").upsert(
    {
      empresa_id: texto(fd, "empresa_id")!,
      loja_id: texto(fd, "loja_id"),
      data: texto(fd, "data")!,
      tipo_venda: Number(fd.get("tipo_venda")),
      valor: numero(fd, "valor") ?? 0,
    },
    { onConflict: "empresa_id,loja_id,data,tipo_venda" }
  );
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/caixa");
  return { ok: true };
}

export async function salvarParametros(fd: FormData): Promise<Resultado> {
  const supabase = await supabaseServer();
  const margemTxt = texto(fd, "margem");
  const clientesTxt = texto(fd, "clientes");
  const { error } = await supabase.from("parametros_mes").upsert(
    {
      empresa_id: texto(fd, "empresa_id")!,
      ano: Number(fd.get("ano")),
      mes: Number(fd.get("mes")),
      margem_bruta_pct: margemTxt ? Number(margemTxt.replace(",", ".")) / 100 : null,
      clientes: clientesTxt ? Number(clientesTxt) : null,
    },
    { onConflict: "empresa_id,ano,mes" }
  );
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/parametros");
  revalidatePath("/dre");
  return { ok: true };
}

/** Salva os nomes dos codigos de uma empresa (despesa, formas, tipos). */
export async function salvarCodigos(fd: FormData): Promise<Resultado> {
  const empresaId = texto(fd, "empresa_id");
  const tabela = texto(fd, "tabela");
  const permitidas = ["codigos_despesa", "codigos_familia", "formas_pagamento", "tipos_recebimento", "tipos_venda"];
  if (!empresaId || !tabela || !permitidas.includes(tabela)) {
    return { ok: false, erro: "Tabela inválida." };
  }

  const supabase = await supabaseServer();
  const alteracoes: { codigo: number; nome: string }[] = [];
  for (const [chave, valor] of Array.from(fd.entries())) {
    const m = chave.match(/^nome_(\d+)$/);
    if (m && typeof valor === "string") {
      alteracoes.push({ codigo: Number(m[1]), nome: valor.trim() });
    }
  }
  if (alteracoes.length === 0) return { ok: true };

  // Um update por codigo: o upsert exigiria reenviar o grupo, que e fixo.
  for (const a of alteracoes) {
    const { error } = await supabase
      .from(tabela)
      .update({ nome: a.nome })
      .eq("empresa_id", empresaId)
      .eq("codigo", a.codigo);
    if (error) return { ok: false, erro: amigavel(error.message) };
  }

  revalidatePath("/codigos");
  revalidatePath("/pagamentos");
  return { ok: true };
}

// ============================================================
// Carteira do gestor
// ============================================================

/**
 * Cadastra um gestor financeiro (nivel 2 da hierarquia).
 * Exclusivo da plataforma: e ela que vende o sistema para os gestores.
 * O RLS ja barra qualquer outro papel, isto aqui so devolve mensagem decente.
 */
export async function salvarGestor(fd: FormData): Promise<Resultado> {
  const nome = texto(fd, "nome");
  if (!nome) return { ok: false, erro: "Informe o nome do gestor." };

  const supabase = await supabaseServer();
  const { data: sessao } = await supabase.auth.getUser();
  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("user_id", sessao.user?.id ?? "")
    .maybeSingle();

  if (perfil?.papel !== "plataforma") {
    return { ok: false, erro: "Apenas a Leads de Sucesso pode cadastrar gestores." };
  }

  const { error } = await supabase.from("gestores").insert({ nome });
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/carteira");
  return { ok: true };
}

export async function salvarCliente(fd: FormData): Promise<Resultado> {
  const nome = texto(fd, "nome");
  if (!nome) return { ok: false, erro: "Informe o nome do cliente." };

  const supabase = await supabaseServer();
  // Sem o filtro por user_id, a plataforma (que le todos os perfis) recebe
  // varias linhas e o maybeSingle falha.
  const { data: sessao } = await supabase.auth.getUser();
  const { data: perfil } = await supabase
    .from("perfis")
    .select("gestor_id, papel")
    .eq("user_id", sessao.user?.id ?? "")
    .maybeSingle();

  // A plataforma escolhe a carteira; o gestor so cria dentro da propria.
  const gestorId = perfil?.papel === "plataforma" ? texto(fd, "gestor_id") : perfil?.gestor_id;
  if (!gestorId) {
    return {
      ok: false,
      erro:
        perfil?.papel === "plataforma"
          ? "Selecione de qual gestor é este cliente."
          : "Sua conta não está vinculada a nenhuma carteira.",
    };
  }

  const { error } = await supabase.from("clientes").insert({ gestor_id: gestorId, nome });
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/carteira");
  return { ok: true };
}

export async function salvarEmpresa(fd: FormData): Promise<Resultado> {
  const nome = texto(fd, "nome");
  const clienteId = texto(fd, "cliente_id");
  if (!nome) return { ok: false, erro: "Informe o nome da empresa." };
  if (!clienteId) return { ok: false, erro: "Selecione o cliente." };

  const supabase = await supabaseServer();
  // O trigger do banco semeia os 100 codigos e a loja matriz automaticamente.
  const { error } = await supabase.from("empresas").insert({ nome, cliente_id: clienteId });
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/carteira");
  return { ok: true };
}

/**
 * Gera o link de convite. E a unica porta de entrada na hierarquia -- quem se
 * cadastra sem convite fica sem vinculo e nao enxerga nada.
 *
 * Convite de GESTOR aponta para um gestor e nao tem cliente; convite de CLIENTE
 * FINAL aponta para um cliente. A constraint destino_coerente, no banco, recusa
 * qualquer combinacao fora disso.
 */
export async function criarConvite(fd: FormData): Promise<{ ok: boolean; erro?: string; token?: string }> {
  const email = texto(fd, "email");
  const papel = texto(fd, "papel") === "gestor" ? "gestor" : "empresario";
  const clienteId = texto(fd, "cliente_id");
  const gestorId = texto(fd, "gestor_id");
  // Quem entra no BPO entra com uma funcao. Sem escolha explicita, o banco
  // aplica "operador" -- a mais limitada das duas que trabalham.
  const funcaoPedida = texto(fd, "funcao");
  const funcao =
    papel === "gestor" && ["admin", "operador", "consulta"].includes(funcaoPedida ?? "")
      ? funcaoPedida
      : papel === "gestor"
        ? "operador"
        : null;

  if (!email) return { ok: false, erro: "Informe o e-mail de quem vai receber o convite." };
  if (papel === "gestor" && !gestorId) return { ok: false, erro: "Selecione o gestor." };
  if (papel === "empresario" && !clienteId) return { ok: false, erro: "Selecione o cliente." };

  const token = crypto.randomUUID().replace(/-/g, "");
  const supabase = await supabaseServer();
  const { data: sessao } = await supabase.auth.getUser();

  const { error } = await supabase.from("convites").insert({
    token,
    email: email.toLowerCase(),
    papel,
    funcao,
    gestor_id: papel === "gestor" ? gestorId : null,
    cliente_id: papel === "gestor" ? null : clienteId,
    criado_por: sessao.user?.id ?? null,
  });
  if (error) return { ok: false, erro: amigavel(error.message) };

  revalidatePath("/carteira");
  return { ok: true, token };
}

export async function revogarConvite(id: string): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("convites").delete().eq("id", id);
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/carteira");
  return { ok: true };
}

export async function aceitarConvite(token: string): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("aceitar_convite", { p_token: token });
  if (error) return { ok: false, erro: amigavel(error.message) };
  const r = data as { ok: boolean; erro?: string };
  if (!r?.ok) return { ok: false, erro: r?.erro ?? "Não foi possível aceitar o convite." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function excluirLancamento(
  tabela: "pagamentos" | "receitas" | "caixa_diario",
  id: string
): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { error } = await supabase.from(tabela).delete().eq("id", id);
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/pagamentos");
  revalidatePath("/receitas");
  revalidatePath("/caixa");
  return { ok: true };
}

// ============================================================
// Marca (white-label)
// ============================================================

export type NivelMarca = "plataforma" | "gestor" | "cliente" | "empresa";

/* Traduz o nivel escolhido na tela para a coluna de dono da tabela `marcas`.
   Quem autoriza e o RLS -- aqui so se monta a linha. Se o usuario forjar um
   nivel que nao e dele, o banco recusa. */
function donoDaMarca(nivel: NivelMarca, id: string | null) {
  return {
    gestor_id: nivel === "gestor" ? id : null,
    cliente_id: nivel === "cliente" ? id : null,
    empresa_id: nivel === "empresa" ? id : null,
  };
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
function cor(fd: FormData, k: string) {
  const v = texto(fd, k);
  if (!v) return null;
  return HEX.test(v) ? v.toUpperCase() : null;
}

export async function salvarMarca(fd: FormData): Promise<Resultado> {
  const nivel = (texto(fd, "nivel") ?? "") as NivelMarca;
  if (!["plataforma", "gestor", "cliente", "empresa"].includes(nivel)) {
    return { ok: false, erro: "Nível inválido." };
  }
  const id = nivel === "plataforma" ? null : texto(fd, "id");
  if (nivel !== "plataforma" && !id) return { ok: false, erro: "Escolha de quem é esta marca." };

  // Campo vazio nao vira string vazia: vira null, que e o que faz herdar do
  // nivel de cima. Sem isso, limpar um campo travaria a heranca com "".
  const linha = {
    ...donoDaMarca(nivel, id),
    nome_exibido: texto(fd, "nome_exibido"),
    tagline: texto(fd, "tagline"),
    cor_primaria: cor(fd, "cor_primaria"),
    cor_secundaria: cor(fd, "cor_secundaria"),
    cor_positivo: cor(fd, "cor_positivo"),
    cor_negativo: cor(fd, "cor_negativo"),
    atualizado_em: new Date().toISOString(),
  };

  const supabase = await supabaseServer();
  const { data: sessao } = await supabase.auth.getUser();

  const filtro =
    nivel === "plataforma"
      ? supabase.from("marcas").select("id").is("gestor_id", null).is("cliente_id", null).is("empresa_id", null)
      : supabase.from("marcas").select("id").eq(`${nivel}_id`, id!);

  const { data: existente } = await filtro.maybeSingle();

  const { error } = existente
    ? await supabase
        .from("marcas")
        .update({ ...linha, atualizado_por: sessao.user?.id ?? null })
        .eq("id", existente.id)
    : await supabase.from("marcas").insert({ ...linha, atualizado_por: sessao.user?.id ?? null });

  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/", "layout");
  return { ok: true };
}

const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const TAMANHO_MAXIMO = 2 * 1024 * 1024;

/**
 * Sobe a logo para o bucket `marcas`.
 *
 * O caminho segue <nivel>/<uuid do dono>/<arquivo> porque e dele que a policy do
 * Storage tira a autorizacao -- pode_gravar_logo() le a primeira e a segunda
 * pasta. Caminho fora dessa forma e recusado pelo banco.
 *
 * O nome do arquivo leva a hora: navegador e CDN guardam imagem em cache por
 * URL, e reaproveitar o mesmo nome faria o cliente continuar vendo a logo antiga
 * depois de trocar.
 */
export async function enviarLogo(fd: FormData): Promise<Resultado & { caminho?: string }> {
  const nivel = (texto(fd, "nivel") ?? "") as NivelMarca;
  const id = nivel === "plataforma" ? "geral" : texto(fd, "id");
  const campo = texto(fd, "campo") === "negativo" ? "logo_negativo_url" : "logo_url";
  const arquivo = fd.get("arquivo");

  if (!["plataforma", "gestor", "cliente", "empresa"].includes(nivel)) {
    return { ok: false, erro: "Nível inválido." };
  }
  if (!id) return { ok: false, erro: "Escolha de quem é esta marca." };
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: "Escolha um arquivo." };
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    return { ok: false, erro: "A logo precisa ser PNG, JPG, SVG ou WEBP." };
  }
  if (arquivo.size > TAMANHO_MAXIMO) return { ok: false, erro: "A logo precisa ter menos de 2 MB." };

  const extensao = { "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg", "image/webp": "webp" }[
    arquivo.type
  ]!;
  const caminho = `${nivel}/${id}/${campo === "logo_url" ? "logo" : "logo-negativa"}-${Date.now()}.${extensao}`;

  const supabase = await supabaseServer();
  const { error: erroUpload } = await supabase.storage
    .from("marcas")
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: true });

  if (erroUpload) {
    const m = erroUpload.message;
    if (m.toLowerCase().includes("bucket")) {
      return { ok: false, erro: "O armazenamento de logos ainda não foi criado no Supabase." };
    }
    return { ok: false, erro: amigavel(m) };
  }

  const dono = donoDaMarca(nivel, nivel === "plataforma" ? null : id);
  const { data: sessao } = await supabase.auth.getUser();

  const filtro =
    nivel === "plataforma"
      ? supabase.from("marcas").select("id").is("gestor_id", null).is("cliente_id", null).is("empresa_id", null)
      : supabase.from("marcas").select("id").eq(`${nivel}_id`, id);
  const { data: existente } = await filtro.maybeSingle();

  const { error } = existente
    ? await supabase.from("marcas").update({ [campo]: caminho }).eq("id", existente.id)
    : await supabase.from("marcas").insert({ ...dono, [campo]: caminho, atualizado_por: sessao.user?.id ?? null });

  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/", "layout");
  return { ok: true, caminho };
}

export async function removerLogo(fd: FormData): Promise<Resultado> {
  const nivel = (texto(fd, "nivel") ?? "") as NivelMarca;
  const id = nivel === "plataforma" ? null : texto(fd, "id");
  const campo = texto(fd, "campo") === "negativo" ? "logo_negativo_url" : "logo_url";

  const supabase = await supabaseServer();
  const filtro =
    nivel === "plataforma"
      ? supabase.from("marcas").select("id").is("gestor_id", null).is("cliente_id", null).is("empresa_id", null)
      : supabase.from("marcas").select("id").eq(`${nivel}_id`, id ?? "");
  const { data: existente } = await filtro.maybeSingle();
  if (!existente) return { ok: true };

  // O arquivo fica no bucket de proposito: some da tela, mas nao se apaga
  // material de marca de cliente por causa de um clique.
  const { error } = await supabase.from("marcas").update({ [campo]: null }).eq("id", existente.id);
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ============================================================
// Empresa
// ============================================================

export async function renomearEmpresa(fd: FormData): Promise<Resultado> {
  const id = texto(fd, "id");
  const nome = texto(fd, "nome");
  if (!id) return { ok: false, erro: "Empresa não identificada." };
  if (!nome) return { ok: false, erro: "Informe o nome da empresa." };

  const supabase = await supabaseServer();
  const { error } = await supabase.from("empresas").update({ nome }).eq("id", id);
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/", "layout");
  return { ok: true };
}

/* Empresa nao se apaga: ela guarda anos de lancamento. Desligar tira do seletor
   e mantem o historico intacto. */
export async function alternarEmpresa(id: string, ativa: boolean): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("empresas").update({ ativa }).eq("id", id);
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/", "layout");
  return { ok: true };
}


/**
 * Troca a funcao de alguem da equipe do BPO.
 *
 * Quem autoriza e o banco: a policy de `perfis` deixa o admin mexer em quem e
 * da mesma carteira, e o trigger impede que a pessoa altere o proprio nivel ou
 * mova alguem para outra carteira. Aqui so se traduz o erro para o usuario.
 */
export async function trocarFuncao(userId: string, funcao: "admin" | "operador" | "consulta"): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { data: sessao } = await supabase.auth.getUser();
  if (sessao.user?.id === userId) {
    return { ok: false, erro: "Você não pode alterar o seu próprio nível de acesso." };
  }

  const { error } = await supabase.from("perfis").update({ funcao }).eq("user_id", userId);
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/carteira");
  return { ok: true };
}
