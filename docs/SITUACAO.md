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

## Painel de suporte (em andamento, 03/11/2026)
Feito no código: aba **🧩 Apps da fábrica** no painel do Financial (`easyapp-financial/site/gestao.html` 1.16.0), ação `fabrica` na
função `gestao` do Financial, função `supabase/functions/gestao-fabrica` + `supabase/fabrica.sql` aqui, e "modo suporte" no núcleo
(`#suporte=` abre o app como o dono numa sessão só daquela aba, com faixa e só leitura quando pedido) e na Mil Terras.
**Falta ligar** (precisa da chave completa do Supabase no ambiente):
1. Rodar `supabase/fabrica.sql` no easyapp-fabrica.
2. Publicar a função `gestao-fabrica` (sem verificação de JWT) com o segredo `FABRICA_SEGREDO` (gerar um aleatório, 32+ caracteres).
3. Na função `gestao` do Financial, segredos `FABRICA_URL=https://sizbmkvzcqiukprdlxxr.supabase.co` e o mesmo `FABRICA_SEGREDO`.

## Próximos (pedidos do dono em 03/11/2026)
- Trazer o Ducairo do Financial (módulo de frota: tabelas `modulos`/`registros`) para o EasyApp Frota, com o login dele.
- Assistente com créditos em todos os apps (reaproveitar o assistente do Financial: módulos, aparência, carteira de créditos, Mercado Pago).
- Para trabalhar sem passos manuais: no ambiente do Claude, chave completa do Supabase (Network secrets, api.supabase.com) e `*.supabase.co` em Allowed domains.
