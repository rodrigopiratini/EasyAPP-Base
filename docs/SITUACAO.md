# Situação da fábrica (03/11/2026)

## Supabase — organização EasyAPP
| Projeto | O que tem |
|---|---|
| EasyApp Financial (`nhngqhgxmrnqbcnklrwc`, nome easyapp-store; já na organização EasyAPP) | Só o EasyApp Financial |
| **EasyAPP-Fábrica** (`sizbmkvzcqiukprdlxxr`, São Paulo) | Pastas `milterras`, `frota`, `golden` (e as próximas) |
| App_Mil_Terras (pausado, EUA) · Golden-CRM (pausado) | Antigos: apagar |

## Apps (cada um com a própria conversa no Claude e o próprio repositório)
| App | Repositório | Endereço | Pasta no banco |
|---|---|---|---|
| EasyApp Financial | easyapp-financial + easyapp | easyappfinancial.com.br | projeto próprio |
| Mil Terras | MilTerras | https://rodrigopiratini.github.io/MilTerras/ | milterras |
| EasyApp Frota | EasyAPP-Frota | https://rodrigopiratini.github.io/EasyAPP-Frota/ | frota |
| Golden CRM | Golden | https://rodrigopiratini.github.io/Golden/gestao/ | golden |

## Regras
- Melhoria no núcleo: só aqui no EasyAPP-Base; depois `bash scripts/atualizar-base.sh ../<app>` e publicar cada app.
- Segmento novo: docs/FABRICA.md › Receita. Pasta nova no banco: `schema` no segmento.js + Exposed schemas.
- Administrador das assinaturas: `insert into <pasta>.plataforma_admins values ('<email>');` em cada pasta.

## Pendências
- Apagar as organizações vazias easyapp-store e Golden (o projeto do Financial já foi transferido para a EasyAPP em 03/11).
- Apagar Vercel (golden-crm) e os projetos pausados.

## Painel de suporte (ligado em 03/11/2026)
Aba **🧩 Apps da fábrica** no painel do Financial (`easyapp-financial/site/gestao.html` 1.16.0) → ação `fabrica` da função
`gestao` do Financial → função `gestao-fabrica` (easyapp-fabrica, sem JWT) → `supabase/fabrica.sql`. "Modo suporte" no núcleo
(`#suporte=` abre o app como o dono numa sessão só daquela aba). Feito: `fabrica.sql` rodado, `gestao-fabrica` publicada,
segredos `FABRICA_SEGREDO` (nos dois projetos, mesma senha) e `FABRICA_URL` (no Financial). O workflow `funcoes.yml` do
Financial passou a usar `--yes` (a CLI nova do Supabase pede confirmação; sem isso nada era publicado).

## Próximos (pedidos do dono em 03/11/2026)
- Trazer o Ducairo do Financial para o EasyApp Frota, com o login dele (mesmo e-mail e senha). O que se sabe: o assistente do
  Financial criou para ele um módulo próprio (tabelas `modulos`, `modulo_versoes` com o html e as `colecoes`, e `registros`
  com os dados), então o formato só se vê no banco do Financial. Passos: ler o módulo e os registros dele, mapear para as coleções
  do Frota (veiculos, motoristas, clientes, viagens, abastecimentos, despesas, manutencoes; criar o que faltar no Frota), criar a
  empresa dele na pasta `frota` (copiar o login com `scripts/migrar-projeto.mjs` ou SQL equivalente), conferir pelo painel
  (Apps da fábrica › 👁 ver) e só então avisar o Ducairo. Não apagar nada no Financial.
  Bloqueio em 03/11: a chave do ambiente só enxerga o projeto da Fábrica; precisa de um token com acesso ao easyapp-store.
- Assistente com créditos em todos os apps (reaproveitar o assistente do Financial: módulos, aparência, carteira de créditos, Mercado Pago).
- Para trabalhar sem passos manuais: no ambiente do Claude, token do Supabase com acesso à organização EasyAPP inteira (Network secrets, api.supabase.com). Hoje ele só vê a Fábrica.
