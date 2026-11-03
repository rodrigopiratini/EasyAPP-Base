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
