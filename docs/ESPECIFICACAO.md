# MAMBIX — Sistema de Gestão Financeira Gerencial
## Especificação Funcional v1.0

> Origem: engenharia reversa da planilha "MAMBIX - MODELO APLICATIVO - 2026" (26 abas, valores + fórmulas) e das transcrições em vídeo do cliente. Este documento é a fonte de verdade do sistema. Tudo que estiver marcado **[VALIDAR]** precisa de confirmação do cliente.

---

## 1. Visão geral

Sistema web (SaaS) para consultoria financeira gerencial de pequenas empresas. Substitui o modelo atual de **uma planilha Excel por mês** por um banco de dados contínuo: os relatórios de qualquer mês/ano são gerados por consulta, e a "evolução 12 meses" deixa de exigir copiar-e-colar.

**Princípio central herdado do Excel:** existem apenas 3 pontos de entrada de dados (Pagamentos, Receitas, Caixa Diário). Todos os relatórios derivam deles.

**Dois regimes, dois relatórios:**
- **DRE (regime de competência):** despesa pertence ao mês em que venceu/foi gerada, independente de ter sido paga. Receita pertence ao mês da venda, independente de ter sido recebida. Responde: *a operação deu lucro?*
- **DFC / Fluxo de Caixa (regime de caixa):** só o que de fato entrou e saiu de dinheiro no mês. Responde: *tem dinheiro no caixa?*

**Melhoria estrutural sobre o Excel:** pagamento de conta atrasada (competência de mês anterior, pago hoje) hoje quebra o modelo mensal do cliente. No sistema: o lançamento entra na DRE do mês de **competência** e no DFC do mês do **pagamento**, automaticamente.

---

## 2. Usuários e permissões

| Perfil | Acesso |
|---|---|
| **Consultor (admin)** | Todas as empresas; cria empresas, lojas e usuários; lança e edita; configura tabelas de códigos; vê todos os relatórios |
| **Empresário** | Somente a(s) sua(s) empresa(s) e lojas; visualiza relatórios; **[VALIDAR]** se também pode lançar ou só visualizar |

Estrutura multi-tenant: **Consultor → Empresas (1..n) → Lojas (1..n: matriz, filiais)**. No Excel isso aparece como "FLUXO DE CAIXA - 1", "DRE 1", coluna LOJA etc.

---

## 3. Tabelas de códigos (configuração)

Cada empresa nasce com o conjunto padrão abaixo, editável (nomes dos códigos são personalizáveis; a estrutura de grupos é fixa).

### 3.1 Códigos de Despesa — CD (1 a 100) — empresa

| Faixa | Grupo | Entra na DRE? | Entra no DFC? |
|---|---|---|---|
| 01–05 | PRÓ-LABORE (particular/sócios) | Sim | Sim |
| 06–25 | RH - PESSOAL | Sim | Sim |
| 26–60 | FIXAS / OPERACIONAIS | Sim | Sim |
| 61–70 | IMPOSTOS | Sim | Sim |
| 71–80 | FINANCEIRAS | Sim | Sim |
| 81–90 | VARIÁVEIS | Sim | Sim |
| 91–98 | INVESTIMENTOS | **Não** | Sim |
| 99 | RETIRADA SÓCIO | **Não** | Sim |
| 100 | PRODUTOS - INSUMOS - ESTOQUE | **Não** | Sim |

Nomes padrão (extraídos do Excel): 1–5 Particular; 6 Salário; 7 Vales/Adiantamento; 8 Seguro de vida; 9 PLR; 10 Rescisões; 11 Multa FGTS; 12 Férias; 13 Décimo terceiro; 14 Processos trabalhistas; 15 Alimentação; 16 Vale transporte; 17 Assistência médica/farmácia; 18 Exames médicos; 19 Recrutamento/treinamento; 20 Uniformes/EPI; 21 Motoboy; 23 FGTS; 24 INSS; 25 Outras despesas de RH; 26 Aluguel de equipamentos; 27 Gás; 28 Seguros empresa; 29 Uber/aplicativos; 30 Softwares/sistemas; 31 Aluguel + condomínio; 32 IPTU; 33 Água; 34 Luz; 35 Telefone fixo; 36 Telefone móvel; 37 Internet; 38 Advogado; 39 Contador; 40 Cartório; 41 Correios; 42 Despesas com viagens; 43 Higiene e limpeza; 44 Material de escritório; 45 Sindicato e associações; 46 Taxas e licenças; 47 Manutenção geral; 48 Segurança; 49 Estacionamento; 50 Combustível; 51 Documentação veículos; 52 Manutenção veículos; 53 Multas veículos; 54 Seguro veículos; 55 Pedágio; 57 Marketing; 58 Consultoria; 59 Devoluções; 60 Outras despesas fixas; 61 PIS; 62 COFINS; 63 ISS; 64 ICMS; 65 IRPJ; 66 CSLL; 67 DARE; 68 DARF; 69 Tributos mobiliários; 70 Simples Nacional; 71 Empréstimos; 72 Juros de empréstimos; 73 Juros/encargos cheque especial; 74 Juros/encargos fornecedores; 75 Antecipações cartões e duplicatas; 76 IOF; 77 Tarifas bancárias; 78 Aluguel maquininha; 79 Descontos concedidos; 80 Outras despesas financeiras; 82 Comissões de vendedores; 83 Prêmios por meta/bonificações; 84 Fretes; 85 Embalagem/sacolas; 86 Taxas cartão débito; 87 Taxas cartão crédito; 88 Taxas PIX; 89 Taxas cartão alimentação; 90 Outras despesas variáveis; 91 Imóveis/terrenos; 92 Veículos; 93 Móveis e utensílios; 94 Reforma; 95 Equipamentos/máquinas; 96 Consórcios; 97 Aplicações financeiras; 98 Outros investimentos; 99 Retirada sócio; 100 Produtos/insumos/estoque. (Códigos sem nome ficam livres para o cliente usar.)

### 3.2 Código de Fluxo de Caixa — CFC (1 a 4)

1 = FIXAS · 2 = VARIÁVEIS · 3 = NÃO OPERACIONAL · 4 = INVESTIMENTOS. Classifica cada pagamento para o resumo do DFC/Fluxo Diário.

### 3.3 Código de Pagamento — CP (1 a 12) — como foi pago

1 Dinheiro · 2 Cheque · 3 Títulos/boletos/carnês · 4 Guias/impostos · 5 Débito automático · 6 Depósito bancário · 7 TED/Transferência/PIX · 8 Cartão débito · 9 Cartão crédito · 10 Saque · 11–12 livres. (Excel comporta 20; usa 12.)

### 3.4 Tipos de Recebimento (1 a 12) — Receitas

1 Dinheiro · 2 Cartão débito · 3 Cartão crédito · 4 **[VALIDAR nome]** · 5 Boletos · 6 Cheques · 7 PIX/TED/Depósito · 8 Antecipações · 9 Receitas financeiras · 10 Sócios · 11 Empréstimos · 12 Outras entradas.

### 3.5 Tipos de venda — Caixa Diário

Abertura de caixa · Dinheiro · Cheque pré · Cheque · Crediário · Cartão crédito · Cartão débito · Convênio · Outros · PIX (+ slots livres).

### 3.6 Códigos da Família — DRE doméstica (1 a 100)

| Faixa | Grupo |
|---|---|
| 01–15 | MORADIA |
| 16–20 | ALIMENTAÇÃO |
| 21–25 | PESSOAIS |
| 26–30 | SAÚDE |
| 31–35 | EDUCAÇÃO |
| 36–40 | LAZER |
| 41–50 | VEÍCULOS |
| 51–60 | FINANCEIRAS |
| 61–65 | SEGUROS |
| 66–70 | IMPOSTOS |
| 71–95 | OUTRAS DESPESAS |
| 96–100 | INVESTIMENTOS |

Nomes padrão conforme Excel (Água, Eletrodomésticos, Faxineira, Gás, Internet, Luz... Supermercado, Academia, Plano de saúde, Faculdade, IPVA, Poupança etc.). Os nomes específicos do cliente atual (ex.: "Aluguel Sr. Walter") mostram que **cada família personaliza seus códigos**.

### 3.7 Bancos / Locais de pagamento

Cadastro simples por empresa (ex.: Itaú, Caixa, Santander, Bradesco, Brasil + "Caixa da empresa"). Usado em Pagamentos (local de pagamento), Receitas (banco) e Fluxo Diário (saldos iniciais).

---

## 4. Telas de lançamento (entrada de dados)

### 4.1 Pagamentos — a base de tudo

Um lançamento por conta paga **ou vencida no mês**. Campos:

| Campo | Regra |
|---|---|
| Dia | dia do pagamento/vencimento |
| CFC | 1–4 (fixa, variável, não operacional, investimento) |
| CD | código de despesa 1–100 |
| Descrição | texto livre |
| Competência | mês/ano a que a conta pertence (default: mês corrente; editável para conta atrasada) |
| Valor | R$ |
| Local de pagamento | banco/caixa |
| CP | forma de pagamento 1–12 |
| Pago? | S (pago, azul) / N (não pago) |
| Loja | matriz/filial |
| Casa | código da família 1–100 (opcional — quando a conta é do orçamento doméstico) |

**Regras de destino do lançamento:**
- DRE do mês M: entra se **competência = M** (pago ou não).
- DFC do mês M: entra se **pago = S e data de pagamento em M**.
- Se `casa` preenchido: entra também na DRE Família (pela competência) **[VALIDAR: competência ou pagamento?]**.
- Painel lateral do Excel (totalizador por CP, por CFC, por código) vira agregação automática na tela.
- Filtro por código de despesa: listar todos os pagamentos de um código no mês (ex.: "o que compôs os R$ 3.000 de manutenção?").

### 4.2 Receitas — o que de fato entrou

| Campo | Regra |
|---|---|
| Dia | dia do recebimento |
| Descrição | texto livre (ex.: extrato: "CIELO VDA DEBITO MASTER") |
| Valor | R$ |
| Banco | onde caiu |
| Cód. tipo de recebimento | 1–12 (§3.4) |

Alimenta o lado "Entradas" do DFC e do Fluxo Diário. **Detalhe do Excel:** a linha "Dinheiro" do resumo soma receitas em dinheiro + total de dinheiro do Caixa Diário **[VALIDAR regra exata — evitar dupla contagem]**.

### 4.3 Caixa Diário — o que vendeu (fechamento de caixa)

Por dia (1–31), por loja: valor vendido em cada tipo de venda (§3.5), independente de recebido. Totaliza o faturamento do mês por forma de venda, que alimenta a DRE (lado esquerdo) e o Faturamento Diário.

---

## 5. Relatórios (tudo automático)

Todos filtram por **empresa + loja (ou consolidado) + mês/ano**, com % sobre o faturamento, e podem ser vistos em qualquer mês passado.

### 5.1 DRE Gerencial (mensal)
- **Esquerda — Faturamento/Vendas:** total por tipo de venda (do Caixa Diário), com %.
- **Direita — Despesas por grupo:** Pró-labore, RH, Fixas/Operacionais, Impostos, Financeiras, Variáveis (investimentos NÃO entram), com %.
- **Corpo — 100 códigos:** valor por código (soma dos pagamentos por competência), com %. Clique no código → lista dos lançamentos (substitui o filtro do Excel).
- **Rodapé:**
  - Faturamento (= total do Caixa Diário)
  - CPV/CMV = Faturamento − Lucro Bruto
  - **Lucro Bruto = Faturamento × margem % informada** (a margem bruta, ex. 61,68%, é parâmetro digitado pelo consultor por mês) **[VALIDAR: manter como parâmetro]**
  - Despesas (total dos grupos DRE)
  - **Resultado = Lucro Bruto − Despesas** (R$ e %)

### 5.2 DFC — Demonstrativo do Fluxo de Caixa (mensal)
- **Entradas:** por tipo de recebimento (da tela Receitas).
- **Saídas:** os mesmos 100 códigos + grupos, **só o que foi pago no mês**, incluindo os grupos exclusivos do caixa: Investimentos (91–98), Retirada de sócio (99), Estoque/insumos (100).
- **Rodapé:** Entradas, Saídas, Resultado (pode ser negativo).

### 5.3 Fluxo Diário (resumo do caixa)
- Saldo inicial por banco (digitado) + por dia: saldo inicial, entradas, saídas, saldo do dia, acumulado.
- Rodapé: totais do mês + saídas por CFC (fixas, variáveis, não operacionais, investimentos) + conferência/diferença.

### 5.4 Faturamento Diário por Loja
- Por dia: valor, acumulado, média; dia da semana.
- **Média por dia da semana** (seg–dom) — em que dia se vende mais/menos.

### 5.5 DRE Contábil (formato apresentação)
Receita Bruta − impostos s/ vendas − descontos − devoluções = Receita Líquida − CPV/CMV − custos variáveis = Lucro Bruto/MC − despesas (pró-labore, RH, fixas, impostos, financeiras) = Resultado Operacional − IR/CSLL = **Resultado Líquido**. Inclui **PEF** (ponto de equilíbrio financeiro), lucro desejável % e **PEE** (ponto de equilíbrio econômico).

### 5.6 Fluxo Contábil (formato apresentação)
(+) Receitas operacionais − custo variável = Margem de Contribuição − despesas fixas = LOAI − investimentos = Lucro Operacional ± não operacionais = **Resultado Líquido**. Com PEF, lucro desejável % e PEE.

### 5.7 Evolução DRE (12 meses)
Colunas jan–dez + total + média/mês. Linhas: 100 códigos; faturamento por forma de venda; total de despesas por grupo; faturamento/CMV/lucro bruto/despesas/lucro líquido/margem de contribuição; e a mesma tabela **em % do faturamento**. Gerada por consulta — sem copiar-e-colar.

### 5.8 Evolução DFC (12 meses)
Mesma lógica, com entradas/saídas e grupos do caixa.

### 5.9 Gráficos
- **Faturamento:** evolução 12 meses, comparativos (mês anterior, mesmo mês do ano anterior, acumulado vs ano anterior), ticket médio, nº de clientes, anos anteriores, gráfico de colunas.
- **Lucro líquido:** mesma estrutura.
- Arquitetura preparada para gráficos de qualquer código/grupo no futuro.

### 5.10 Simulador de Cenários (DRE e DFC)
A partir do mês base (faturamento, CMV, custos variáveis, MC, despesas fixas, LOAI, investimentos, não operacionais, lucro): o usuário digita variações em % e vê o novo resultado e a diferença no lucro, em 4 alavancas independentes: **preço médio**, **quantidade vendida**, **custo variável**, **despesa fixa**.

### 5.11 DRE Família (orçamento doméstico)
100 códigos da casa agrupados (§3.6), receitas (pró-labore) vs despesas e **resultado do mês** — a pessoa gasta mais ou menos do que ganha.

### 5.12 Impressão (DRE e DFC)
Versão paginada para impressão: códigos 1–50 / 51–100 / totalizadores por grupo + resultado. No sistema: **exportar PDF** com CSS de impressão.

---

## 5.13 Importação em massa — Excel e PDF (planejado)

Módulo para o consultor subir dados sem digitar lançamento a lançamento:

- **Excel/CSV**: importar planilhas de Pagamentos, Receitas e Caixa Diário. Tela de conferência ("de-para") ligando as colunas do arquivo aos campos do sistema, com pré-visualização e validação antes de gravar. Deve aceitar as planilhas mensais que o consultor já usa hoje, servindo também para migrar o histórico.
- **PDF**: leitura de extratos bancários e faturas de cartão, com extração de data, descrição e valor; a classificação (código de despesa, CFC) é sugerida e confirmada pelo usuário.
- Regras: detectar duplicidade antes de gravar, permitir desfazer uma importação inteira (lote identificado), e nunca gravar sem confirmação humana.

**Prioridade: alta** — é o que elimina o trabalho manual do consultor. Entra logo após os relatórios principais.

---

## 6. Módulo futuro (fora do escopo v1)

Balanço Patrimonial: abas "ENTRADA - BALANÇO", "BALANÇO + DRE COM ÍNDICES", evoluções de Ativo/Passivo/PL e "INDICADORES FINANCEIROS". O cliente pediu explicitamente para deixar para depois. A modelagem do banco deve permitir acoplar esse módulo sem retrabalho.

---

## 7. Regras de negócio consolidadas

1. Competência ≠ caixa: todo pagamento carrega **duas datas lógicas** (competência e pagamento) e cada relatório usa a sua.
2. Investimentos (91–100) nunca entram na DRE; sempre entram no DFC.
3. Não pago (N) entra na DRE (se competência do mês) e fica **pendente** no caixa — o sistema deve listar contas vencidas não pagas.
4. Conta paga atrasada: DFC do mês do pagamento + DRE do mês de competência (retroativo automático).
5. % sempre sobre o faturamento do mês (Caixa Diário).
6. Margem bruta (%) é parâmetro mensal informado pelo consultor → CMV é derivado.
7. Multi-loja: lançamentos identificam loja; relatórios por loja ou consolidado **[VALIDAR: existe visão consolidada?]**.
8. Orçamento familiar é paralelo: mesmo lançamento pode alimentar empresa e casa.

---

## 8. Stack e arquitetura

- **Front:** Next.js (App Router) + Tailwind — estética SaaS moderna, telas de lançamento em grade rápida (tipo planilha).
- **Back/BD:** Supabase (Postgres + Auth + RLS para multi-tenant).
- **Hospedagem:** Vercel. Código no GitHub.
- Relatórios = views/queries SQL; sem duplicação de dados.

### Modelo de dados (resumo)
```
organizacoes (consultoria)
  usuarios (consultor | empresario)
  empresas → lojas
    codigos_despesa (1-100, grupo, nome)     -- por empresa
    codigos_familia (1-100, grupo, nome)
    formas_pagamento / tipos_recebimento / tipos_venda
    bancos
    pagamentos (dia, cfc, cd, descricao, competencia_mes/ano,
                valor, banco_id, cp, pago, loja_id, cod_familia?)
    receitas   (dia, descricao, valor, banco_id, tipo_recebimento)
    caixa_diario (data, loja_id, tipo_venda, valor)
    parametros_mes (margem_bruta_pct, saldos_iniciais, ticket/clientes)
```

---

## 9. Roadmap de construção

1. ~~Especificação~~ (este documento)
2. Banco + fundação (Supabase, auth, multi-tenant, seeds dos códigos)
3. Telas de lançamento (Pagamentos, Receitas, Caixa Diário)
4. Relatórios (DRE, DFC, contábeis, fluxo/faturamento diário, evoluções, gráficos, família, PDF)
5. Simuladores + publicação
6. (futuro) Balanço Patrimonial
