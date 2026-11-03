# Situação da fábrica (03/11/2026)

## Supabase — organização EasyAPP
| Projeto | O que tem |
|---|---|
| EasyApp Financial (`nhngqhgxmrnqbcnklrwc`, ainda na organização easyapp-store) | Só o EasyApp Financial |
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
- Transferir o projeto do Financial para a organização EasyAPP e apagar easyapp-store e Golden.
- Apagar Vercel (golden-crm) e os projetos pausados.

## Painel de suporte (ligado em 03/11/2026)
Aba **🧩 Apps da fábrica** no painel do Financial (`easyapp-financial/site/gestao.html` 1.16.0) → ação `fabrica` da função
`gestao` do Financial → função `gestao-fabrica` (easyapp-fabrica, sem JWT) → `supabase/fabrica.sql`. "Modo suporte" no núcleo
(`#suporte=` abre o app como o dono numa sessão só daquela aba). Feito: `fabrica.sql` rodado, `gestao-fabrica` publicada,
segredos `FABRICA_SEGREDO` (nos dois projetos, mesma senha) e `FABRICA_URL` (no Financial). O workflow `funcoes.yml` do
Financial passou a usar `--yes` (a CLI nova do Supabase pede confirmação; sem isso nada era publicado).

## Próximos (pedidos do dono em 03/11/2026)
- Trazer o Ducairo do Financial (módulo de frota: tabelas `modulos`/`registros`) para o EasyApp Frota, com o login dele.
- Assistente com créditos em todos os apps (reaproveitar o assistente do Financial: módulos, aparência, carteira de créditos, Mercado Pago).
- Para trabalhar sem passos manuais: no ambiente do Claude, chave completa do Supabase (Network secrets, api.supabase.com) e `*.supabase.co` em Allowed domains.
