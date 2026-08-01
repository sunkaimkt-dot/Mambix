# MAMBIX — Sistema de Gestão Financeira Gerencial

SaaS de gestão financeira para consultoria de pequenas empresas: DRE gerencial,
fluxo de caixa (DFC), evoluções 12 meses, simuladores de cenário e orçamento familiar.
Substitui o modelo de planilhas Excel mensais por banco de dados contínuo.

- **Especificação completa:** [docs/ESPECIFICACAO.md](docs/ESPECIFICACAO.md)
- **Stack:** Next.js + Supabase (Postgres) + Vercel

## Estrutura do projeto
- `docs/` — especificação e documentação
- `src/` — aplicação Next.js
- `supabase/migrations/` — schema e políticas de acesso
- `supabase/testes/` — validação do banco

## Hierarquia de acesso

```
LEADS DE SUCESSO (plataforma)   vê tudo
  └── Gestor financeiro          vê apenas a própria carteira
        └── Cliente              pode ter várias empresas (CNPJs)
              └── Empresa
                    └── Loja
```

**Um gestor não pode saber que outro gestor existe.** Isso não é filtro de tela: é
RLS no Postgres. Se a interface tiver bug, ou alguém chamar a API na mão, o dado
continua invisível. Quem se cadastra sem convite não enxerga uma linha sequer.

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
npm run testar:banco
```

Sobe um Postgres real em WASM, aplica todas as migrations do zero e valida o
isolamento entre gestores e a separação competência/caixa. Rode isto sempre que
mexer em política de acesso — uma recursão de policy só aparece em execução.

