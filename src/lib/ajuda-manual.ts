/**
 * Base de conhecimento do assistente de duvidas (chat "Dúvidas?").
 *
 * E o que a IA pode usar para responder -- e SO isso. Mantenha em dia junto
 * com o sistema: se uma tela mudar, mude aqui tambem (e no guia em PDF).
 *
 * `para: "equipe"` = assunto da area da Mambix; o cliente nao recebe esse
 * trecho (o filtro e feito no servidor, pelo papel de quem esta logado).
 */

export type SecaoManual = { titulo: string; para: "todos" | "equipe"; texto: string };

export const MANUAL: SecaoManual[] = [
  {
    titulo: "Como o sistema funciona",
    para: "todos",
    texto: `O sistema substitui a planilha financeira mensal. Tudo fica num banco de dados contínuo e qualquer relatório de qualquer mês sai na hora.
Só se digita (ou importa) em três telas: Pagamentos (toda conta que venceu no mês, paga ou não), Receitas (todo dinheiro que entrou no banco ou caixa) e Caixa Diário (quanto se vendeu por dia, por forma de venda). Uma vez por mês preenche-se Parâmetros do mês. Todo o resto (Painel, DRE, Fluxo de Caixa, relatórios contábeis, fluxo e faturamento diário, evoluções, gráficos, simulador, impressão) é calculado sozinho.`,
  },
  {
    titulo: "Competência × caixa (a ideia mais importante)",
    para: "todos",
    texto: `A DRE (competência) responde "a operação deu lucro?": a despesa entra no mês a que a conta pertence, paga ou não; a receita entra no mês da venda (Caixa Diário).
O DFC / Fluxo de Caixa (caixa) responde "tem dinheiro no caixa?": a despesa entra no mês em que o dinheiro saiu (data da baixa); a receita entra no mês em que o dinheiro entrou (tela Receitas).
Exemplo: o aluguel de agosto venceu em 05/08 e foi pago em 10/09. Aparece na DRE de agosto e no DFC de setembro. Lança-se uma vez só, em agosto; em setembro só se registra o pagamento (a "baixa"). Nunca lance a mesma conta duas vezes.`,
  },
  {
    titulo: "Quem acessa e o que pode",
    para: "todos",
    texto: `Cliente: vê e lança só nas empresas dele; não vê outros clientes nem a área da Mambix.
Equipe da Mambix: administrador (tudo, inclusive cadastrar clientes, convidar pessoas, editar códigos e marca), operador (lança, edita e dá baixa) e consulta (só lê).
A separação é garantida pelo banco de dados, não só pela tela.`,
  },
  {
    titulo: "Entrar, sair e senha",
    para: "todos",
    texto: `Abra o endereço do sistema no navegador, digite e-mail e senha e clique em Entrar. Você cai no Painel. Para sair, clique em Sair no rodapé do menu, abaixo do seu nome.
O sistema ainda não tem "esqueci minha senha" nem tela para trocar a senha: para redefinir, fale com a Mambix.
O primeiro acesso de alguém novo é por convite: a pessoa abre o link, confirma o e-mail, cria uma senha (mínimo 8 caracteres) e clica em Criar conta e entrar.`,
  },
  {
    titulo: "Menu, seletor e tours",
    para: "todos",
    texto: `Menu à esquerda: Painel; Lançamentos (Pagamentos, Contas em aberto, Receitas, Caixa Diário, Parâmetros do mês, Importar Excel / PDF); Relatórios (DRE Gerencial, Fluxo de Caixa (DFC), DRE Contábil, Fluxo Contábil, Fluxo Diário, Faturamento Diário, Impressão / PDF); Análises (Evolução DRE, Evolução DFC, Gráficos, Simulador de cenários); Cadastros (Bancos e lojas). No celular o menu lateral fica escondido.
Seletor no canto superior direito de toda tela: Empresa, Loja (uma loja ou "Todas as lojas" = consolidado), Mês e Ano. Tudo o que a tela mostra e grava vale para o que estiver escolhido. O erro mais comum é lançar na empresa ou no mês errado: confira sempre o subtítulo da tela (ex.: "Setembro/2026 — Pão Dourado LTDA").
Tours: no primeiro acesso abre o tour completo do sistema; depois cada tela tem o botão "Tour guiado" ao lado do título, e o tour completo pode ser revisto pelo link "Tour completo do sistema" no rodapé do menu. Setas do teclado avançam e voltam, Esc fecha.`,
  },
  {
    titulo: "Pagamentos",
    para: "todos",
    texto: `Lançamentos › Pagamentos. Toda conta que venceu no mês, paga ou não (aluguel, luz, salário, fornecedor, imposto). É a base da DRE.
Como lançar: Vencimento (o mês dessa data vira a competência, escrita abaixo do formulário); CFC (1 Fixa, 2 Variável, 3 Não operacional, 4 Investimento — classifica a saída no Fluxo de Caixa); Código da despesa (um dos 100 códigos, ex.: 34 Luz — define a linha e o grupo na DRE); Descrição (opcional); Valor; Forma de pagto.; Banco / caixa; Loja. Se já foi paga, marque "Já foi pago" e informe a data em "Pago em"; se não, deixe desmarcado e ela fica em aberto. Clique em Lançar pagamento.
Embaixo: Total do mês (competência), Já pago e Em aberto; a lista de contas com a situação; à direita, o Total por grupo.
Para registrar o pagamento de uma conta em aberto, clique no selo "Em aberto" (abre a janela de baixa).
Lançou errado? Clique em "excluir" na linha e lance de novo — não existe edição de lançamento.
Códigos 91 a 98 (investimentos), 99 (retirada de sócio) e 100 (produtos/insumos/estoque) não entram na DRE, só no Fluxo de Caixa. Na DRE o custo da mercadoria vem da margem bruta.`,
  },
  {
    titulo: "Contas em aberto e baixa",
    para: "todos",
    texto: `Lançamentos › Contas em aberto lista tudo o que não foi pago, de qualquer mês: vencidas (antes do mês do seletor) em cima, a vencer embaixo. Colunas "Já pago" e "Falta" mostram pagamentos parciais.
Dar baixa: clique no selo "Em aberto" da conta; em "Pago em" coloque a data real em que o dinheiro saiu (é ela que leva a saída ao DFC do mês certo); confira Valor, Forma e Banco; clique em Registrar pagamento.
Pagou menos: registre o valor pago; a conta fica "Parcial · falta R$ …". Pode dar várias baixas.
Pagou mais (juros/multa): digite o valor realmente pago; o sistema avisa que a diferença vira juro e pede o código do juro (ex.: 72 Juros de empréstimos, 74 Juros e encargos – fornecedores). O juro é lançado sozinho, já pago, no mês do pagamento.
Errou a baixa? Abra a janela de novo: os pagamentos feitos aparecem com a opção de desfazer.
Pagou uma conta atrasada de outro mês? Não lance de novo: dê baixa aqui com a data real.`,
  },
  {
    titulo: "Receitas",
    para: "todos",
    texto: `Lançamentos › Receitas. Todo dinheiro que entrou de fato num banco ou no caixa: crédito da maquininha, PIX, depósito, rendimento, empréstimo recebido, aporte de sócio. São as entradas do Fluxo de Caixa.
Campos: Data em que o dinheiro entrou; Descrição (dica: copie como está no extrato, ex.: "CIELO VDA DEBITO"); Tipo de recebimento (Dinheiro, Cartão débito, Cartão crédito, Vale alimentação/refeição, Boletos, Cheques, PIX/TED/Depósito, Antecipações, Receitas financeiras, Sócios, Empréstimos, Outras entradas); Banco; Valor. Clique em Lançar entrada.
Receita × venda: Receitas é dinheiro que entrou (vai para o DFC); Caixa Diário é o que se vendeu (vai para a DRE). Uma venda no crédito entra no Caixa Diário no dia da venda e em Receitas no dia em que a operadora depositar. A venda em dinheiro só entra no DFC quando lançada em Receitas.
As receitas são da empresa como um todo: o DFC não as separa por loja.`,
  },
  {
    titulo: "Caixa Diário",
    para: "todos",
    texto: `Lançamentos › Caixa Diário. O fechamento de vendas: quanto se vendeu em cada dia, por forma de venda, recebido ou não. É daqui que sai o faturamento da DRE.
Escolha a loja no seletor (com "Todas as lojas" a grade grava na loja matriz). Clique na célula do dia e da forma de venda, digite o valor e aperte Enter (ou clique fora): grava na hora. Para corrigir, clique de novo; para zerar, apague o valor.
As colunas são os tipos de venda da empresa (Dinheiro, Cheque pré, Cheque, Crediário, Cartão crédito, Cartão débito, Convênio, Outros, PIX). Para mudar os nomes, fale com a Mambix.
Mês inteiro de uma vez: importe a planilha pela tela Importar, opção Caixa Diário.`,
  },
  {
    titulo: "Parâmetros do mês",
    para: "todos",
    texto: `Lançamentos › Parâmetros do mês. Três informações por mês, por empresa.
Margem bruta (%): quanto do faturamento sobra depois do custo da mercadoria (ex.: 58,52). Lucro bruto = Faturamento × margem; CMV = Faturamento − Lucro bruto; Resultado = Lucro bruto − Despesas. Sem margem o Painel e os Gráficos mostram o mês sem resultado — preencha sempre.
Número de clientes atendidos (opcional): calcula o ticket médio em Gráficos.
Saldo inicial dos bancos: quanto havia em cada banco/caixa no dia 1º. É o ponto de partida do Fluxo Diário. Deixe em branco o banco que não usa e clique em Salvar saldos. A partir do segundo mês, o botão "Preencher com o saldo final do mês anterior" calcula banco a banco (saldo inicial anterior + receitas − pagamentos); confira com o extrato antes de salvar.`,
  },
  {
    titulo: "Importar planilha ou extrato",
    para: "todos",
    texto: `Lançamentos › Importar Excel / PDF. Traz muitos lançamentos de uma vez; nada é gravado sem conferir e uma importação inteira pode ser desfeita.
Planilha (.xlsx ou .csv): escolha Pagamentos, Receitas ou Caixa Diário, a Loja e, se a planilha não tiver coluna de banco, o Banco padrão. Selecione o arquivo (sem modelo? "Baixar planilha modelo (.xlsx)"). Ligue as colunas (campos com * são obrigatórios). Clique em Conferir linhas: cada linha aparece como ok, duplicado, erro (com o motivo) ou "dia já lançado". Desmarque o que não quiser e clique em Importar N linhas. As linhas que ficaram de fora podem ser baixadas num .csv para corrigir.
Extrato bancário (PDF ou OFX): vira Pagamentos já pagos (saídas) e Receitas (entradas). Escolha antes o Banco padrão = banco do extrato. Selecione o arquivo; abre a revisão: confira Entrada/Saída, a Classificação sugerida e a Forma (linhas em amarelo pedem atenção; o código escolhido vale para as linhas com a mesma descrição). Desmarque o que não deve entrar (ex.: transferência entre contas próprias). Clique em Continuar para a conferência, importe, e depois use o botão "Agora importar as entradas/saídas deste extrato" para a outra metade.
OFX (opção "exportar extrato" do internet banking) é lido com exatidão; PDF é lido por aproximação (confira com cuidado); PDF escaneado/foto não é lido.
Desfazer: em "Importações anteriores", no fim da tela, desfaça o lote inteiro.`,
  },
  {
    titulo: "Painel",
    para: "todos",
    texto: `Primeira tela após o login, resumo do mês: Faturamento (soma do Caixa Diário); Entradas, Saídas e Resultado de caixa (mesma base do DFC); Contas em aberto no mês; Atrasado de meses anteriores; gráfico Entradas x Saídas de 12 meses; Resultado mensal de 12 meses (precisa da margem bruta); Despesas por grupo; Contas a pagar (atrasado e próximos 30 dias, a partir de hoje).`,
  },
  {
    titulo: "DRE Gerencial e Fluxo de Caixa (DFC)",
    para: "todos",
    texto: `DRE Gerencial (competência): faturamento por forma de venda com %; despesas por grupo (Pró-labore, RH, Fixas/Operacionais, Impostos, Financeiras, Variáveis); faixa do resultado (Faturamento, CMV, Lucro bruto, Despesas, Resultado em R$ e %); detalhamento pelos 100 códigos.
Investigar um número: o ícone de lista ao lado do valor de um código abre os lançamentos que o formaram; clicar no número do código abre a evolução dele no ano; o filtro no topo (descrição, valor de/até, forma, situação) recorta o relatório.
Fluxo de Caixa / DFC (caixa): só o que entrou e saiu de fato no mês; entradas por tipo de recebimento; saídas por grupo, incluindo investimentos, retirada de sócio e estoque; resultado do mês e saídas por CFC. A empresa pode dar lucro na DRE e ficar sem dinheiro no caixa — olhe os dois.`,
  },
  {
    titulo: "DRE Contábil, Fluxo Contábil e ponto de equilíbrio",
    para: "todos",
    texto: `Mesmos números da DRE e do DFC no formato contábil de apresentação.
DRE Contábil: Receita bruta − impostos − descontos − devoluções = Receita líquida − CMV − custos variáveis = Lucro bruto / Margem de contribuição − despesas = Resultado operacional − IR/CSLL = Resultado líquido.
Fluxo Contábil: Receitas operacionais − custo variável = Margem de contribuição − despesas fixas = LOAI − investimentos = Lucro operacional ± não operacionais = Resultado líquido, com saldo inicial e final. As saídas seguem o CFC de cada pagamento.
Ponto de equilíbrio: PEF (financeiro) é a receita que só paga as despesas; PEE (econômico) é a receita que paga as despesas e entrega o lucro desejado. O "Lucro desejável (%)" fica no topo: mude e clique em Recalcular.`,
  },
  {
    titulo: "Fluxo Diário e Faturamento Diário",
    para: "todos",
    texto: `Fluxo Diário: saldo inicial, entradas, saídas, saldo do dia e acumulado. Começa no saldo inicial de Parâmetros do mês (sem ele, começa em zero). Mostra em que dia o caixa aperta. Confira o saldo final com o extrato: se não bater, faltou lançamento ou baixa. Com uma loja escolhida, o saldo inicial não é usado (ele é da empresa toda).
Faturamento Diário: vendas do Caixa Diário dia a dia comparadas com o mesmo dia do mês anterior; faturamento do mês, média diária, média por dia da semana e participação de cada forma de venda.`,
  },
  {
    titulo: "Evoluções e Gráficos",
    para: "todos",
    texto: `Evolução DRE e Evolução DFC: os 12 meses do ano lado a lado, com total e média. Botões: R$ ou % do faturamento; só códigos com valor ou todos. Clique numa linha para ver a evolução do item. Só o ano do seletor importa aqui.
Gráficos: escolha Faturamento ou Lucro líquido; compara o mês com o anterior, com o mesmo mês do ano passado e o acumulado do ano; colunas mês a mês, linhas dos anos anteriores, ticket médio e número de clientes (dependem do número de clientes em Parâmetros do mês) e tabela com total e média.`,
  },
  {
    titulo: "Simulador de cenários",
    para: "todos",
    texto: `Análises › Simulador de cenários responde "e se…?". Parte de um mês (ou da média de 3, 6 ou 12 meses) e mostra o novo resultado ao mexer em quatro alavancas em %: Preço médio, Quantidade vendida, Custo variável (CMV e códigos 81–90) e Despesa fixa. Dá para ajustar grupo a grupo em "Ajustar por grupo de despesa" e alternar entre DRE e Fluxo de caixa. Nada do que se mexe é gravado.`,
  },
  {
    titulo: "Impressão e PDF",
    para: "todos",
    texto: `Relatórios › Impressão / PDF: DRE Gerencial e DFC no formato de papel. Escolha a aba e o mês, clique em Imprimir / Salvar PDF e, na janela do navegador, em "Destino" escolha "Salvar como PDF". DRE Gerencial, DFC, DRE Contábil, Fluxo Contábil e as Evoluções também têm esse botão na própria tela.`,
  },
  {
    titulo: "Bancos e lojas",
    para: "todos",
    texto: `Cadastros › Bancos e lojas. A empresa já vem com os bancos mais comuns e a loja MATRIZ. Clique no nome para renomear. Nos bancos, o selo "em uso"/"desligado" liga e desliga: desligar não apaga, só tira o banco das listas de lançamento. Em lojas, cadastre as filiais.
Banco não aparece ao lançar? Está desligado ou não foi cadastrado.`,
  },
  {
    titulo: "Rotina do mês",
    para: "todos",
    texto: `Dia a dia: Caixa Diário (vendas) e Pagamentos (contas novas).
Toda semana: Receitas e as baixas em Contas em aberto, com a data real do pagamento.
No fechamento: Parâmetros do mês (margem, clientes, saldo inicial); conferir o Fluxo Diário com o extrato; ver se nada ficou vencido em Contas em aberto; revisar DRE e DFC (abrir códigos estranhos pelo ícone de lista); gerar os PDFs; olhar Gráficos e Evolução.`,
  },
  {
    titulo: "Problemas comuns",
    para: "todos",
    texto: `Paguei conta de mês passado, lanço de novo? Não: dê baixa em Contas em aberto com a data real.
Lancei na empresa ou mês errado: exclua o lançamento, corrija o seletor e lance de novo.
DRE com lucro bruto zero / Painel sem resultado: falta a margem bruta em Parâmetros do mês.
Fluxo Diário começa em R$ 0,00: falta o saldo inicial dos bancos em Parâmetros do mês.
Ticket médio vazio: falta o número de clientes em Parâmetros do mês.
Banco não aparece: está desligado ou não existe, em Bancos e lojas.
Código de despesa não aparece na lista: está desativado nas listas da empresa; fale com a Mambix.
Importei arquivo errado: desfaça o lote em Importações anteriores, na tela Importar.
PDF do extrato não foi lido: é imagem escaneada ou layout não reconhecido; use o OFX.
"Você não tem permissão para esta operação": sua função não permite ou a empresa não é sua; fale com a Mambix.
Esqueci a senha: fale com a Mambix.`,
  },
  {
    titulo: "Glossário",
    para: "todos",
    texto: `Competência: mês a que a conta pertence, paga ou não (base da DRE). Caixa: mês em que o dinheiro entrou ou saiu (base do DFC). Baixa: registro de que uma conta foi paga. DRE: faturamento − custos − despesas = lucro ou prejuízo. DFC: entradas − saídas. Código de despesa: os 100 códigos em grupos fixos. CFC: 1 Fixa, 2 Variável, 3 Não operacional, 4 Investimento. Forma de pagamento: dinheiro, boleto, PIX etc. Margem bruta: % do faturamento que sobra depois do custo da mercadoria. CMV: custo da mercadoria vendida. Margem de contribuição: o que sobra depois dos custos variáveis. LOAI: lucro operacional antes dos investimentos. PEF/PEE: pontos de equilíbrio financeiro e econômico. Ticket médio: faturamento ÷ clientes. Consolidado: todas as lojas somadas. OFX: arquivo de extrato lido com exatidão. Lote de importação: tudo o que entrou numa importação; pode ser desfeito.`,
  },

  // ------------------------------------------------------------ so equipe
  {
    titulo: "Cliente novo (equipe)",
    para: "equipe",
    texto: `Mambix › Clientes e equipe › Novo cliente: nome do cliente, nome da empresa (ou CNPJ) e e-mail de quem vai acessar; clique em Cadastrar cliente. A empresa nasce com os 100 códigos, a loja MATRIZ, os bancos comuns e o link de convite (vale 7 dias, só para aquele e-mail; botão Copiar).
Depois: escolha a empresa no seletor, ajuste Bancos e lojas, confira Códigos e listas, preencha Parâmetros do mês, lance ou importe o mês e confira Painel e DRE. Para histórico, importe planilha e preencha a margem de cada mês.
Mais opções: Mais uma empresa (outro CNPJ do mesmo cliente); Reenviar acesso / convidar (aba Cliente ou aba Equipe Mambix com a função Administrador, Operador ou Consulta); Cliente sem empresa ainda.
Equipe Mambix: troque a função pelo seletor ao lado do nome (ninguém muda a própria). Convites pendentes: "revogar" cancela um link.
Empresas: clique no nome para renomear; × desliga (some do seletor, histórico fica); ↺ religa. Empresa sumiu do seletor = foi desligada.
Convite não funciona: venceu (7 dias) ou outro e-mail; gere outro em Mais opções › Reenviar acesso.`,
  },
  {
    titulo: "Códigos, listas e marca (equipe)",
    para: "equipe",
    texto: `Mambix › Códigos e listas: cada empresa tem suas listas (Códigos de despesa, Tipos de recebimento, Formas de pagamento, Tipos de venda (caixa)). Mude o nome e clique em Salvar alterações (vale só para a empresa escolhida). Os grupos são fixos (ex.: 26–60 sempre Fixas/Operacionais). Nome em branco tira o código das listas de lançamento.
Mambix › Marca e cores: nome exibido, linha de apoio, cor principal, cores de positivo/negativo e logo (PNG, JPG, SVG ou WEBP, até 2 MB). Vale para todos. "Como vai ficar" mostra a prévia.`,
  },
];

export function manualPara(papel: string): string {
  const equipe = papel === "plataforma" || papel === "gestor";
  return MANUAL.filter((s) => s.para === "todos" || equipe)
    .map((s) => `## ${s.titulo}\n${s.texto}`)
    .join("\n\n");
}
