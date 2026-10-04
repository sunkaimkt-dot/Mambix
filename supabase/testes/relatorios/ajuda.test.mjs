// TESTE DO CHAT DE DUVIDAS (instrucoes enviadas a IA)
//
// O que nao pode quebrar:
//   1. Cliente NAO recebe o manual da area da equipe; equipe recebe.
//   2. A tela atual entra nas instrucoes (nome + dicas do tour da tela).
//   3. Cliente nao recebe dicas de tela que so a equipe acessa.
//   4. Regras de seguranca presentes (nao inventar, nao ver dados, nao pedir senha).
//
// Rodar:  npm run testar:ajuda
import { montarInstrucoes, telaAtual } from "../../../src/lib/ajuda-prompt.ts";

let falhas = 0;
const ok = (t) => console.log(`  \x1b[32mOK\x1b[0m  ${t}`);
const erro = (t, d) => { falhas++; console.log(`  \x1b[31mFALHOU\x1b[0m  ${t}${d ? `\n        ${d}` : ""}`); };
const checa = (t, cond, d) => (cond ? ok(t) : erro(t, d));

console.log("\n\x1b[1mCHAT DE DÚVIDAS\x1b[0m");
const cli = montarInstrucoes("empresario", "/pagamentos");
const eq = montarInstrucoes("gestor", "/pagamentos");
checa("Cliente não recebe o manual da equipe", !cli.includes("Cliente novo (equipe)") && !cli.includes("Marca e cores:"));
checa("Equipe recebe o manual da equipe", eq.includes("Cliente novo (equipe)") && eq.includes("Marca e cores:"));
checa("Cliente é avisado como CLIENTE", cli.includes("Quem pergunta é CLIENTE"));
checa("Tela atual entra nas instruções", cli.includes("AGORA: Pagamentos.") && cli.includes("O que tem nesta tela:"));
checa("Rota de evolução cai no tour certo", telaAtual("/evolucao/31").chave === "evolucao-item");
checa("Rota desconhecida não quebra", telaAtual("/xyz").chave === null && montarInstrucoes("empresario", "/xyz").includes("não identificada"));
const cliCarteira = montarInstrucoes("empresario", "/carteira");
checa("Cliente não recebe dicas de tela só da equipe", !cliCarteira.includes("O que tem nesta tela:"));
checa("Equipe recebe dicas da tela de Clientes", montarInstrucoes("plataforma", "/carteira").includes("O que tem nesta tela:"));
checa("Regras de segurança presentes",
  cli.includes("Nunca invente") && cli.includes("NÃO vê os dados") && cli.includes("Nunca peça senha"));
checa("Tamanho razoável (cabe folgado no modelo)", cli.length < 40000, String(cli.length));

if (falhas) { console.log(`\n\x1b[31m${falhas} FALHA(S)\x1b[0m`); process.exit(1); }
console.log("\n\x1b[32m\x1b[1mTODOS OS TESTES DO CHAT PASSARAM\x1b[0m");
