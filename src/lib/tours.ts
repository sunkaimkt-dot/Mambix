/**
 * Conteudo do tour guiado, tela a tela.
 *
 * Cada passo aponta para um elemento marcado com data-tour="<alvo>" na tela
 * (o componente Cartao aceita a prop `tour`). Passo sem `alvo` aparece no
 * centro da tela. Passo cujo alvo nao existe ou nao esta visivel (ex.: menu no
 * celular, area da equipe para o cliente, lista vazia) e pulado sozinho --
 * por isso o mesmo roteiro serve para a equipe e para o cliente.
 *
 * `soEquipe`: passo que so faz sentido para a equipe da Mambix.
 * A chave do tour e o primeiro trecho da URL (ver chaveDoTour).
 */

export type PassoTour = { alvo?: string; titulo: string; texto: string; soEquipe?: boolean };
/** soEquipe no tour inteiro: tela da area da Mambix (o cliente nao tem acesso). */
export type Tour = { nome: string; passos: PassoTour[]; soEquipe?: boolean };

const SELETOR: PassoTour = {
  alvo: "seletor",
  titulo: "De quem e de quando",
  texto: "Empresa, loja, mês e ano. Tudo o que esta tela mostra e grava vale para o que estiver escolhido aqui — confira antes de lançar.",
};
const BOTAO: PassoTour = {
  alvo: "botao-tour",
  titulo: "Quer rever?",
  texto: "Este tour aparece só na primeira vez. Para ver de novo, clique em Tour guiado em qualquer tela.",
};
const IMPRIMIR: PassoTour = {
  alvo: "imprimir",
  titulo: "Imprimir ou salvar em PDF",
  texto: "Abre a impressão do navegador já formatada. Em \"Destino\", escolha Salvar como PDF para mandar ao cliente.",
};

export const TOURS: Record<string, Tour> = {
  dashboard: {
    nome: "Painel",
    passos: [
      {
        titulo: "Bem-vindo à Mambix",
        texto: "Este é o sistema de gestão financeira da Mambix. Em poucos passos você conhece a tela. Cada tela tem o próprio tour, que aparece na primeira vez que você entra nela.",
      },
      {
        alvo: "menu",
        titulo: "O menu",
        texto: "Lançamentos é onde se digita (pagamentos, receitas, caixa). Relatórios e Análises são calculados sozinhos a partir deles. Cadastros guarda bancos e lojas.",
      },
      SELETOR,
      { alvo: "indicadores", titulo: "O mês em números", texto: "Faturamento (vendas do Caixa Diário), entradas e saídas de caixa, o resultado e o que está em aberto ou atrasado." },
      { alvo: "grafico-caixa", titulo: "Entradas x Saídas", texto: "O caixa dos últimos 12 meses: o que entrou e o que saiu de fato." },
      { alvo: "grafico-resultado", titulo: "Resultado mensal", texto: "Lucro ou prejuízo pela DRE. Mês sem margem bruta em Parâmetros do mês fica sem barra." },
      { alvo: "contas-pagar", titulo: "Contas a pagar", texto: "O que está atrasado e o que vence nos próximos 30 dias. O link leva para Contas em aberto, onde se registra o pagamento." },
      { alvo: "atalhos", titulo: "Começar por aqui", texto: "Atalhos para as três telas de entrada: Pagamentos, Receitas e Caixa Diário." },
      BOTAO,
    ],
  },

  pagamentos: {
    nome: "Pagamentos",
    passos: [
      { titulo: "Pagamentos", texto: "Aqui entra toda conta que venceu no mês, paga ou não. É a base da DRE." },
      SELETOR,
      { alvo: "form", titulo: "Lançar uma conta", texto: "Vencimento (o mês dele vira a competência), CFC, código da despesa, valor, forma, banco e loja. Se já foi paga, marque \"Já foi pago\" e informe a data." },
      { alvo: "totais", titulo: "Totais do mês", texto: "Total da competência, quanto já foi pago e quanto falta." },
      { alvo: "lista", titulo: "Contas do mês", texto: "Clique no selo da situação (Em aberto / Parcial) para registrar um pagamento. Lançou errado? Use \"excluir\" e lance de novo." },
      { alvo: "grupos", titulo: "Total por grupo", texto: "Como as contas do mês se distribuem nos grupos da DRE." },
      BOTAO,
    ],
  },

  "em-aberto": {
    nome: "Contas em aberto",
    passos: [
      { titulo: "Contas em aberto", texto: "Tudo o que ainda não foi pago, de qualquer mês. Pagou uma conta antiga? Registre aqui — nunca lance a conta de novo." },
      { alvo: "totais", titulo: "Quanto falta pagar", texto: "Total em aberto e, em vermelho, o que já venceu." },
      { alvo: "vencidas", titulo: "Vencidas", texto: "Contas que venceram antes do mês escolhido. Clique no selo \"Em aberto\" e informe a data REAL do pagamento — é ela que leva a saída para o DFC certo." },
      { alvo: "a-vencer", titulo: "A vencer", texto: "Do mês escolhido em diante. Pagou menos? A conta fica parcial. Pagou mais? O sistema lança a diferença como juro." },
      BOTAO,
    ],
  },

  receitas: {
    nome: "Receitas",
    passos: [
      { titulo: "Receitas", texto: "Todo dinheiro que de fato entrou num banco ou no caixa: maquininha, PIX, depósito, rendimento. É o lado das entradas do Fluxo de Caixa." },
      { alvo: "form", titulo: "Lançar uma entrada", texto: "Data em que o dinheiro entrou, descrição (copie do extrato), tipo de recebimento, banco e valor." },
      { alvo: "lista", titulo: "Entradas do mês", texto: "Tudo o que entrou no mês, com a opção de excluir." },
      { alvo: "resumo", titulo: "Por tipo de recebimento", texto: "Quanto entrou em dinheiro, cartão, PIX etc." },
      BOTAO,
    ],
  },

  caixa: {
    nome: "Caixa Diário",
    passos: [
      { titulo: "Caixa Diário", texto: "O fechamento de vendas: quanto se vendeu em cada dia, por forma de venda, recebido ou não. É daqui que sai o faturamento da DRE." },
      { alvo: "seletor", titulo: "Escolha a loja", texto: "A grade é de uma loja por vez. Com \"Todas as lojas\", ela mostra a matriz." },
      { alvo: "grade", titulo: "Preencher a grade", texto: "Clique na célula do dia e da forma de venda, digite o valor e aperte Enter. Grava na hora. Para zerar, apague o valor." },
      BOTAO,
    ],
  },

  parametros: {
    nome: "Parâmetros do mês",
    passos: [
      { titulo: "Parâmetros do mês", texto: "Três informações que você digita uma vez por mês, por empresa." },
      { alvo: "margem", titulo: "Margem bruta e clientes", texto: "A margem bruta calcula o CMV e o lucro na DRE — sem ela o mês fica sem resultado. O número de clientes serve para o ticket médio." },
      { alvo: "saldos", titulo: "Saldo inicial dos bancos", texto: "Quanto havia em cada banco no dia 1º. É o ponto de partida do Fluxo Diário. Do segundo mês em diante, use \"Preencher com o saldo final do mês anterior\" e confira com o extrato." },
      BOTAO,
    ],
  },

  importar: {
    nome: "Importar",
    passos: [
      { titulo: "Importar", texto: "Traz muitos lançamentos de uma vez: planilha (.xlsx/.csv) ou extrato bancário (.pdf/.ofx). Nada é gravado sem você conferir." },
      { alvo: "importar-tipo", titulo: "O que e de onde", texto: "Escolha o tipo (pagamentos, receitas ou caixa), a loja e o banco padrão. Para extrato, o banco padrão é o banco do extrato. Sem modelo? Baixe a planilha modelo." },
      { alvo: "historico", titulo: "Importações anteriores", texto: "Cada importação vira um lote. Se algo saiu errado, desfaça o lote inteiro por aqui." },
      BOTAO,
    ],
  },

  dre: {
    nome: "DRE Gerencial",
    passos: [
      { titulo: "DRE Gerencial", texto: "Responde \"a operação deu lucro?\". Regime de competência: tudo o que pertence ao mês, pago ou não." },
      { alvo: "filtro", titulo: "Filtro", texto: "Recorte o relatório por descrição, valor, forma de pagamento ou situação." },
      { alvo: "faturamento", titulo: "Faturamento", texto: "Vendas do Caixa Diário por forma de venda, com % sobre o total." },
      { alvo: "despesas", titulo: "Despesas por grupo", texto: "Investimentos, estoque e retirada de sócio não entram aqui — só no Fluxo de Caixa." },
      { alvo: "resultado", titulo: "Resultado", texto: "Faturamento × margem bruta = lucro bruto; menos as despesas = resultado." },
      { alvo: "codigos", titulo: "Os 100 códigos", texto: "Clique no número de um código para ver a evolução no ano, ou no ícone de lista para ver os lançamentos que formaram o valor." },
      IMPRIMIR,
    ],
  },

  dfc: {
    nome: "Fluxo de Caixa (DFC)",
    passos: [
      { titulo: "Fluxo de Caixa (DFC)", texto: "Responde \"tem dinheiro no caixa?\". Só o que entrou e saiu de fato no mês." },
      { alvo: "entradas", titulo: "Entradas", texto: "Vêm da tela Receitas, por tipo de recebimento." },
      { alvo: "saidas", titulo: "Saídas por grupo", texto: "Vêm dos pagamentos efetivados (baixas), incluindo investimentos, retirada de sócio e estoque." },
      { alvo: "resultado", titulo: "Resultado do mês", texto: "Entradas menos saídas. Pode ser negativo." },
      { alvo: "cfc", titulo: "Saídas por CFC", texto: "Fixa, variável, não operacional e investimento — conforme o CFC de cada pagamento." },
      { alvo: "codigos", titulo: "Os 100 códigos", texto: "O mesmo detalhamento da DRE, pelo que foi pago no mês." },
      IMPRIMIR,
    ],
  },

  "dre-contabil": {
    nome: "DRE Contábil",
    passos: [
      { titulo: "DRE Contábil", texto: "Os números da DRE Gerencial no formato de apresentação, da receita bruta ao resultado líquido." },
      { alvo: "lucro-desejavel", titulo: "Lucro desejável", texto: "Mude o percentual e clique em Recalcular para ver o ponto de equilíbrio com essa meta." },
      { alvo: "demonstrativo", titulo: "Demonstrativo", texto: "Cada linha mostra de quais códigos vem o valor." },
      { alvo: "equilibrio", titulo: "Ponto de equilíbrio", texto: "PEF: a receita que só paga as despesas. PEE: a receita que paga as despesas e entrega o lucro desejado." },
      IMPRIMIR,
    ],
  },

  "fluxo-contabil": {
    nome: "Fluxo Contábil",
    passos: [
      { titulo: "Fluxo Contábil", texto: "O Fluxo de Caixa no formato de apresentação: margem de contribuição, LOAI, lucro operacional e resultado líquido." },
      { alvo: "lucro-desejavel", titulo: "Lucro desejável", texto: "Mude o percentual e clique em Recalcular." },
      { alvo: "demonstrativo", titulo: "Demonstrativo", texto: "As saídas seguem o CFC escolhido em cada pagamento. Embaixo: saldo inicial, resultado e saldo final." },
      { alvo: "equilibrio", titulo: "Ponto de equilíbrio", texto: "PEF e PEE calculados pelo caixa." },
      IMPRIMIR,
    ],
  },

  "fluxo-diario": {
    nome: "Fluxo Diário",
    passos: [
      { titulo: "Fluxo Diário", texto: "O caixa dia a dia — mostra em que dia o dinheiro aperta." },
      { alvo: "indicadores", titulo: "Saldo inicial e final", texto: "O saldo inicial vem de Parâmetros do mês. Sem ele, o fluxo começa em zero." },
      { alvo: "tabela", titulo: "Dia a dia", texto: "Entradas, saídas, saldo do dia e acumulado. Confira o saldo final com o extrato: se não bate, falta lançamento ou baixa." },
      { alvo: "cfc", titulo: "Saídas por CFC", texto: "As saídas do mês separadas em fixa, variável, não operacional e investimento." },
      BOTAO,
    ],
  },

  "faturamento-diario": {
    nome: "Faturamento Diário",
    passos: [
      { titulo: "Faturamento Diário", texto: "As vendas do Caixa Diário dia a dia." },
      { alvo: "indicadores", titulo: "Resumo", texto: "Faturamento do mês, média diária e a comparação com o mês anterior." },
      { alvo: "grafico", titulo: "Dia a dia", texto: "Barras mais claras são fim de semana. A linha tracejada é o mesmo dia do mês anterior." },
      { alvo: "semana", titulo: "Por dia da semana", texto: "Em que dia se vende mais — e menos." },
      { alvo: "tipos", titulo: "Por tipo de venda", texto: "Quanto do faturamento vem de cada forma de venda." },
      BOTAO,
    ],
  },

  impressao: {
    nome: "Impressão / PDF",
    passos: [
      { titulo: "Impressão / PDF", texto: "A DRE Gerencial e o DFC no formato de papel da planilha antiga." },
      { alvo: "abas", titulo: "Escolha o relatório", texto: "DRE Gerencial ou Fluxo de Caixa, e o mês no seletor do topo." },
      IMPRIMIR,
    ],
  },

  "evolucao-dre": {
    nome: "Evolução DRE",
    passos: [
      { titulo: "Evolução DRE", texto: "Os 12 meses do ano lado a lado, com total e média. Aqui vale só o ano do seletor — o mês não muda nada." },
      { alvo: "opcoes", titulo: "Como ver", texto: "Em R$ ou em % do faturamento; só os códigos com valor ou todos." },
      { alvo: "grafico", titulo: "O ano no gráfico", texto: "Faturamento, despesas e resultado mês a mês." },
      { alvo: "tabela", titulo: "A tabela", texto: "Clique numa linha para ver a evolução daquele item." },
      IMPRIMIR,
    ],
  },

  "evolucao-dfc": {
    nome: "Evolução DFC",
    passos: [
      { titulo: "Evolução DFC", texto: "Os 12 meses do caixa lado a lado, com total e média." },
      { alvo: "opcoes", titulo: "Como ver", texto: "Em R$ ou em % das entradas; só os códigos com valor ou todos." },
      { alvo: "grafico", titulo: "O ano no gráfico", texto: "Entradas, saídas e resultado mês a mês." },
      { alvo: "tabela", titulo: "A tabela", texto: "Clique numa linha para ver a evolução daquele item." },
      IMPRIMIR,
    ],
  },

  "evolucao-item": {
    nome: "Evolução de um item",
    passos: [
      { titulo: "Evolução de um item", texto: "Um código, grupo ou tipo ao longo do ano, com total, média e o maior mês. Barras acima da média ficam destacadas. Use \"Ver por caixa\" para comparar competência e pagamento." },
      BOTAO,
    ],
  },

  graficos: {
    nome: "Gráficos",
    passos: [
      { titulo: "Gráficos", texto: "Faturamento e lucro líquido comparados no tempo." },
      { alvo: "indicador", titulo: "Faturamento ou lucro", texto: "Escolha o que analisar. O lucro precisa da margem bruta de cada mês." },
      { alvo: "comparativos", titulo: "Comparativos", texto: "O mês escolhido contra o mês anterior, o mesmo mês do ano anterior e o acumulado do ano." },
      { alvo: "colunas", titulo: "Ano × ano anterior", texto: "Mês a mês: o ano escolhido em destaque, o anterior em cinza. Passe o mouse para ver os valores." },
      { alvo: "linhas", titulo: "Anos anteriores", texto: "Os últimos três anos juntos, para ver a sazonalidade." },
      { alvo: "ticket", titulo: "Ticket médio e clientes", texto: "Dependem do número de clientes em Parâmetros do mês." },
      { alvo: "tabela", titulo: "Tabela", texto: "Os valores de cada mês, com total, média e a variação contra o ano anterior." },
      BOTAO,
    ],
  },

  simulador: {
    nome: "Simulador de cenários",
    passos: [
      { titulo: "Simulador de cenários", texto: "Responde \"e se…?\". Nada do que você mexe aqui é gravado." },
      { alvo: "base", titulo: "Base", texto: "Parta só do mês escolhido ou da média dos últimos 3, 6 ou 12 meses." },
      { alvo: "regime", titulo: "DRE ou caixa", texto: "Simule pela DRE (lucro) ou pelo Fluxo de Caixa." },
      { alvo: "alavancas", titulo: "Alavancas", texto: "Preço médio, quantidade vendida, custo variável e despesa fixa, em %. Ou ajuste grupo a grupo." },
      { alvo: "resultado", titulo: "Resultado", texto: "Resultado da base, resultado simulado e a diferença. A tabela ao lado mostra linha por linha." },
      BOTAO,
    ],
  },

  bancos: {
    nome: "Bancos e lojas",
    passos: [
      { titulo: "Bancos e lojas", texto: "Os bancos/caixas e as lojas da empresa escolhida." },
      { alvo: "bancos", titulo: "Bancos e caixas", texto: "Clique no nome para renomear. O selo liga e desliga — desligar não apaga, só tira das listas de lançamento novo. O saldo inicial de cada banco fica em Parâmetros do mês." },
      { alvo: "lojas", titulo: "Lojas", texto: "A matriz já vem criada. Cadastre as filiais para separar lançamentos e relatórios por loja." },
      BOTAO,
    ],
  },

  codigos: {
    nome: "Códigos e listas",
    soEquipe: true,
    passos: [
      { titulo: "Códigos e listas", texto: "As listas da empresa escolhida. Cada empresa tem as suas." },
      { alvo: "abas", titulo: "Quatro listas", texto: "Códigos de despesa, tipos de recebimento, formas de pagamento e tipos de venda do caixa." },
      { alvo: "lista", titulo: "Renomear", texto: "Os grupos são fixos — é o que mantém as DREs comparáveis. Mude os nomes à vontade e salve. Nome em branco tira o código das listas." },
      BOTAO,
    ],
  },

  carteira: {
    nome: "Clientes e equipe",
    soEquipe: true,
    passos: [
      { titulo: "Clientes e equipe", texto: "Os clientes da Mambix, as empresas de cada um, a equipe e os convites." },
      { alvo: "novo-cliente", titulo: "Cliente novo", texto: "Nome do cliente, empresa e e-mail de acesso. A empresa já nasce com os códigos, a loja matriz, os bancos comuns e o link de convite — copie e envie ao cliente.", soEquipe: true },
      { alvo: "mais-opcoes", titulo: "Mais opções", texto: "Outra empresa do mesmo cliente, reenviar acesso ou convidar alguém da equipe (administrador, operador ou consulta).", soEquipe: true },
      { alvo: "equipe", titulo: "Equipe", texto: "Troque a função de alguém pelo seletor ao lado do nome." },
      { alvo: "convites", titulo: "Convites pendentes", texto: "Links enviados que ainda não foram usados. Valem 7 dias; use \"revogar\" para cancelar." },
      { alvo: "clientes", titulo: "Clientes e empresas", texto: "Clique no nome de uma empresa para renomear. Passe o mouse e use × para desligar (o histórico fica) ou ↺ para religar." },
      BOTAO,
    ],
  },

  marca: {
    nome: "Marca e cores",
    soEquipe: true,
    passos: [
      { titulo: "Marca e cores", texto: "A identidade da Mambix. Vale para a equipe e para todos os clientes." },
      { alvo: "campos", titulo: "Nome e cores", texto: "Nome exibido, linha de apoio, cor principal e as cores dos números positivos e negativos." },
      { alvo: "logo", titulo: "Logo", texto: "PNG, JPG, SVG ou WEBP, até 2 MB. Fundo transparente fica melhor." },
      { alvo: "previa", titulo: "Prévia", texto: "Como vai ficar, antes de salvar." },
      BOTAO,
    ],
  },
};

/** "/evolucao/31" -> "evolucao-item"; "/dre" -> "dre". */
export function chaveDoTour(pathname: string): string | null {
  const primeiro = pathname.split("/").filter(Boolean)[0] ?? "";
  if (["evolucao", "evolucao-grupo", "evolucao-tipo"].includes(primeiro)) return "evolucao-item";
  return TOURS[primeiro] ? primeiro : null;
}
