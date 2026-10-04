/**
 * Tour completo de boas-vindas: abre sozinho no PRIMEIRO acesso da pessoa ao
 * sistema e passeia pelas telas, na ordem em que ela vai usar no dia a dia.
 * Escrito para o cliente final (quem lanca e acompanha os numeros da propria
 * empresa); a equipe da Mambix ve o mesmo roteiro.
 *
 * Cada passo diz em que tela acontece (`rota`) e o que destacar (`alvo`, um
 * data-tour da tela). O componente TourBoasVindas troca de tela sozinho.
 * Alvo que nao aparecer (lista vazia, celular) faz o passo ser pulado.
 */

export type PassoJornada = {
  rota: string;
  secao: string;
  alvo?: string;
  titulo: string;
  texto: string;
  soEquipe?: boolean;
};

export const CHAVE_JORNADA = "boas-vindas";

export const JORNADA: PassoJornada[] = [
  // ---------------------------------------------------------------- comeco
  {
    rota: "/dashboard",
    secao: "Começo",
    titulo: "Vamos aprender a usar o sistema",
    texto:
      "Em poucos minutos você vai ver onde lançar o dia a dia da empresa e onde acompanhar os resultados. O tour passa por várias telas sozinho — é só ir clicando em Próximo.\n\nPode pular agora e rever depois em \"Tour completo do sistema\", no rodapé do menu.",
  },
  {
    rota: "/dashboard",
    secao: "Começo",
    alvo: "seletor",
    titulo: "Empresa e período",
    texto:
      "Tudo o que você vê e lança vale para a empresa, a loja e o mês escolhidos aqui. Antes de lançar, confira sempre este seletor.",
  },
  {
    rota: "/dashboard",
    secao: "Começo",
    alvo: "menu",
    titulo: "O menu",
    texto:
      "Lançamentos: onde você digita (é a única parte que dá trabalho).\nRelatórios e Análises: prontos, calculados sozinhos a partir do que foi lançado.\nCadastros: seus bancos e lojas.",
  },
  {
    rota: "/dashboard",
    secao: "Painel",
    alvo: "indicadores",
    titulo: "O resumo do mês",
    texto:
      "Quanto vendeu, quanto entrou e saiu do caixa, o que está em aberto e o que atrasou. É a primeira tela que você vê ao entrar.",
  },
  {
    rota: "/dashboard",
    secao: "Painel",
    alvo: "contas-pagar",
    titulo: "Contas a pagar",
    texto: "O que está atrasado e o que vence nos próximos 30 dias. Bom lugar para olhar toda segunda-feira.",
  },

  // ---------------------------------------------------------------- lancamentos
  {
    rota: "/pagamentos",
    secao: "Lançamentos · 1 de 3",
    alvo: "form",
    titulo: "Pagamentos: toda conta da empresa",
    texto:
      "Lance aqui cada conta que venceu no mês — paga ou não: aluguel, luz, salário, fornecedor, imposto.\n\nVencimento, código da despesa (ex.: 34 Luz), valor, forma e banco. Se já pagou, marque \"Já foi pago\" e coloque a data.",
  },
  {
    rota: "/pagamentos",
    secao: "Lançamentos · 1 de 3",
    alvo: "lista",
    titulo: "As contas do mês",
    texto:
      "Cada conta aparece aqui com a situação. Clique no selo \"Em aberto\" para registrar o pagamento. Lançou errado? Clique em \"excluir\" e lance de novo.",
  },
  {
    rota: "/em-aberto",
    secao: "Lançamentos · 1 de 3",
    alvo: "totais",
    titulo: "Pagou uma conta atrasada?",
    texto:
      "Não lance de novo! Venha em Contas em aberto, ache a conta e clique no selo \"Em aberto\". Informe a data em que pagou de verdade.\n\nPagou com juros? Digite o valor pago: o sistema lança a diferença como juro sozinho.",
  },
  {
    rota: "/receitas",
    secao: "Lançamentos · 2 de 3",
    alvo: "form",
    titulo: "Receitas: o dinheiro que entrou",
    texto:
      "Todo dinheiro que caiu no banco ou entrou no caixa: maquininha, PIX, depósito, rendimento.\n\nDica: copie a descrição como aparece no extrato (ex.: \"CIELO VDA DEBITO\") — fica fácil de conferir depois.",
  },
  {
    rota: "/caixa",
    secao: "Lançamentos · 3 de 3",
    alvo: "grade",
    titulo: "Caixa Diário: o que você vendeu",
    texto:
      "No fim do dia, lance quanto vendeu em cada forma (dinheiro, cartão, PIX…), recebido ou não. Clique na célula, digite e aperte Enter.\n\nÉ daqui que sai o faturamento da empresa.",
  },
  {
    rota: "/caixa",
    secao: "Lançamentos · 3 de 3",
    titulo: "Venda × dinheiro que entrou",
    texto:
      "Uma venda no cartão de crédito entra no Caixa Diário no dia da venda e em Receitas no dia em que a operadora depositar. São duas coisas diferentes, e o sistema precisa das duas: uma mostra se você vendeu bem, a outra se tem dinheiro no caixa.",
  },
  {
    rota: "/parametros",
    secao: "Uma vez por mês",
    alvo: "margem",
    titulo: "Margem bruta e clientes",
    texto:
      "A margem bruta (quanto sobra da venda depois do custo da mercadoria) é o que permite calcular o lucro. O número de clientes atendidos calcula o ticket médio.\n\nCombine com a Mambix quem preenche.",
  },
  {
    rota: "/parametros",
    secao: "Uma vez por mês",
    alvo: "saldos",
    titulo: "Saldo dos bancos no dia 1º",
    texto:
      "Quanto havia em cada banco no primeiro dia do mês. A partir do segundo mês, o botão \"Preencher com o saldo final do mês anterior\" faz a conta — só confira com o extrato.",
  },
  {
    rota: "/importar",
    secao: "Atalho",
    alvo: "importar-tipo",
    titulo: "Importar em vez de digitar",
    texto:
      "Tem uma planilha ou o extrato do banco? Importe aqui. Para extrato, prefira o arquivo OFX do internet banking — é lido sem erro.\n\nO sistema sugere a classificação de cada linha e você confere antes de gravar. Nada entra sem você confirmar.",
  },

  // ---------------------------------------------------------------- resultados
  {
    rota: "/dre",
    secao: "Resultados",
    alvo: "resultado",
    titulo: "DRE: a empresa deu lucro?",
    texto:
      "Faturamento, custo, despesas e o resultado do mês. Conta pelo mês a que cada despesa pertence, mesmo que ainda não tenha sido paga.",
  },
  {
    rota: "/dre",
    secao: "Resultados",
    alvo: "codigos",
    titulo: "De onde veio cada número",
    texto:
      "Os 100 códigos de despesa com o valor do mês. Clique no ícone de lista ao lado de um valor para ver os lançamentos que formaram aquele número.",
  },
  {
    rota: "/dfc",
    secao: "Resultados",
    alvo: "resultado",
    titulo: "Fluxo de Caixa: sobrou dinheiro?",
    texto:
      "Só o que entrou e saiu de verdade no mês. A empresa pode dar lucro na DRE e mesmo assim ficar sem dinheiro no caixa — por isso olhe os dois.",
  },
  {
    rota: "/fluxo-diario",
    secao: "Resultados",
    alvo: "tabela",
    titulo: "O caixa dia a dia",
    texto:
      "Saldo de cada dia do mês: mostra em que dia o dinheiro aperta. Confira o saldo final com o extrato do banco — se não bater, faltou lançar alguma coisa.",
  },
  {
    rota: "/graficos",
    secao: "Análises",
    alvo: "comparativos",
    titulo: "Comparar com o passado",
    texto:
      "Faturamento ou lucro do mês comparados com o mês anterior, com o mesmo mês do ano passado e no acumulado do ano.",
  },
  {
    rota: "/simulador",
    secao: "Análises",
    alvo: "alavancas",
    titulo: "E se…?",
    texto:
      "Teste cenários: e se eu subir o preço 5%? E se cortar 10% das despesas fixas? Nada do que você mexe aqui é gravado.",
  },
  {
    rota: "/impressao",
    secao: "Análises",
    alvo: "imprimir",
    titulo: "Imprimir ou salvar em PDF",
    texto:
      "Os relatórios têm o botão Imprimir / Salvar PDF. Na janela que abrir, escolha \"Salvar como PDF\" para guardar ou enviar.",
  },

  // ---------------------------------------------------------------- cadastros
  {
    rota: "/bancos",
    secao: "Cadastros",
    alvo: "bancos",
    titulo: "Seus bancos",
    texto:
      "A empresa já vem com os bancos mais comuns. Desligue os que você não usa e cadastre os que faltarem — assim a lista fica limpa na hora de lançar.",
  },

  // ---------------------------------------------------------------- fim
  {
    rota: "/dashboard",
    secao: "Pronto!",
    alvo: "ajuda",
    titulo: "Ficou com dúvida? Pergunte aqui",
    texto:
      "O botão Dúvidas?, no canto da tela, abre um assistente que explica como fazer qualquer coisa no sistema. Ele sabe em que tela você está.\n\nEle não vê os números da empresa — e não escreva senhas nem dados sigilosos nele.",
  },
  {
    rota: "/dashboard",
    secao: "Pronto!",
    titulo: "Sua rotina no sistema",
    texto:
      "No dia a dia: Caixa Diário (vendas) e Pagamentos (contas novas).\nToda semana: Receitas e as baixas em Contas em aberto.\nNo fim do mês: Parâmetros do mês e uma olhada na DRE e no Fluxo de Caixa.\n\nCada tela tem o botão \"Tour guiado\" ao lado do título, este tour completo fica no rodapé do menu e o botão Dúvidas? responde na hora. Se ainda ficar dúvida, fale com a Mambix.",
  },
];

/** "/evolucao/31" -> chave do tour daquela tela (mesma regra de chaveDoTour). */
export function telasDaJornada(): string[] {
  return Array.from(new Set(JORNADA.map((p) => p.rota.split("/").filter(Boolean)[0])));
}
