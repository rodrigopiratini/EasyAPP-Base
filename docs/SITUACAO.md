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
- ~~Trazer o Ducairo do Financial para o Frota~~ **feito em 03/11/2026**: empresa Transportes Ducairo na pasta `frota`, login copiado
  (mesmo e-mail e senha), módulo Acertos mapeado para veiculos/motoristas/viagens/abastecimentos/despesas (detalhes no SITUACAO.md do Frota).
  Falta: conferir pelo painel e avisar o Ducairo.
- Assistente com créditos em todos os apps (reaproveitar o assistente do Financial: módulos, aparência, carteira de créditos, Mercado Pago).
- Token do Supabase no ambiente do Claude: desde 03/11 enxerga a Fábrica e o easyapp-store (Financial).
