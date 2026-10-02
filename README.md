# MAMBIX — Sistema de Gestão Financeira Gerencial

Sistema da Mambix para o controle financeiro dos clientes dela (pequenas empresas):
DRE gerencial, fluxo de caixa (DFC), evoluções 12 meses, gráficos, simulador de cenários
e importação de planilhas e extratos bancários (PDF/OFX).
Substitui o modelo de planilhas Excel mensais por banco de dados contínuo.

- **Especificação completa:** [docs/ESPECIFICACAO.md](docs/ESPECIFICACAO.md)
- **Stack:** Next.js + Supabase (Postgres) + Vercel

## Estrutura do projeto
- `docs/` — especificação e documentação
- `src/` — aplicação Next.js
- `supabase/migrations/` — schema e políticas de acesso
- `supabase/testes/` — validação do banco

## Quem acessa

```
MAMBIX (dono + equipe: administrador / operador / consulta)   vê todos os clientes
  └── Cliente              vê e lança só nas próprias empresas (CNPJs)
        └── Empresa
              └── Loja
```

Login na raiz do domínio. Gente nova só entra por **convite** (tela *Clientes e
equipe*). Quem se cadastra sem convite não enxerga uma linha sequer — isso é RLS no
Postgres, não filtro de tela.

Por baixo, o banco ainda tem a estrutura de carteiras de quando o sistema seria
vendido para outros BPOs (migration 0006); desde a 0121 existe uma carteira só, a
da Mambix (`gestores.principal`), e todo cliente novo cai nela.

## Competência × caixa

As duas datas de um pagamento são diferentes e não devem ser confundidas:

- `vencimento` — quando a conta vence. Não muda depois de lançada.
- `comp_mes`/`comp_ano` — competência: **em qual DRE** a despesa entra, paga ou não.
- `pagamento_baixas.data_pagamento` — quando o dinheiro saiu. **Alimenta o DFC.**

Um aluguel que venceu em junho e foi pago em julho aparece na DRE de junho e no
DFC de julho. Para isso não se lança de novo: dá-se baixa no lançamento existente
(tela *Contas em aberto*). Várias baixas no mesmo lançamento = pagamento parcial.

O campo `pago` é **derivado** das baixas por trigger — nunca editar na mão.

## Testes

```bash
npm run testar:banco        # migrations + RLS (Postgres real em WASM)
npm run testar:relatorios   # DRE/DFC/contábeis/evoluções
npm run testar:combo3       # importação e simulador
npm run testar:graficos     # tela Gráficos
npm run testar:extrato      # leitor de extrato PDF/OFX e classificação
```

Sobe um Postgres real em WASM, aplica todas as migrations do zero e valida o
isolamento entre gestores e a separação competência/caixa. Rode isto sempre que
mexer em política de acesso — uma recursão de policy só aparece em execução.

