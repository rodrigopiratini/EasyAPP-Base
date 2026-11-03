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
| EasyAPP Frota | EasyAPP-Frota | https://rodrigopiratini.github.io/EasyAPP-Frota/ | frota |
| Golden CRM | Golden | https://rodrigopiratini.github.io/Golden/gestao/ | golden |

## Regras
- Melhoria no núcleo: só aqui no EasyAPP-Base; depois `bash scripts/atualizar-base.sh ../<app>` e publicar cada app.
- Segmento novo: docs/FABRICA.md › Receita. Pasta nova no banco: `schema` no segmento.js + Exposed schemas.
- Administrador das assinaturas: `insert into <pasta>.plataforma_admins values ('<email>');` em cada pasta.

## Pendências
- Apagar as organizações vazias easyapp-store e Golden (o projeto do Financial já foi transferido para a EasyAPP em 03/11).
- Apagar Vercel (golden-crm) e os projetos pausados.

## Suporte: abrir a empresa de um cliente (desde 03/11/2026, à noite)
O **Desenvolvedor** (quem está em `<pasta>.plataforma_admins`) entra no app de Gestão com o próprio e-mail › **Plataforma** › **Ver** (só ver) ou
**Corrigir** (ver e corrigir) na linha da empresa. O app recarrega com os dados dela, como o Administrador da empresa vê, com a faixa "Suporte · empresa
· até HH:MM" (**Trocar** / **Sair**). Regras no banco (`base.sql`): tabela `suporte_visitas`, `suporte_abrir` / `suporte_sair`;
a visita vale 2 horas e só com a **verificação em duas etapas** (app autenticador) confirmada na sessão (aal2): na primeira vez o app
mostra o QR code. "Só ver" o banco recusa qualquer gravação. O que o suporte faz fica no registro de atividades como "Suporte (e-mail)".
O painel do Financial (aba 🧩 Apps da fábrica) só tem o atalho **abrir ↗**, que leva a `#/plataforma?abrir=<empresa>` no app.
O antigo modo suporte (`#suporte=`, sessão do dono gerada pela `gestao-fabrica` › `abrir_como`) foi retirado.
Painel de gestão (aba **🧩 Apps da fábrica**, `easyapp-financial/site/gestao.html`) → ação `fabrica` da função `gestao` do
Financial → `gestao-fabrica` (easyapp-fabrica, sem JWT) → `supabase/fabrica.sql`: lista, pessoas, assinatura e avisos por push.

## Próximos (pedidos do dono em 03/11/2026)
- ~~Trazer o Ducairo do Financial para o Frota~~ **feito em 03/11/2026**: empresa **TR EDU** na pasta `frota`, login copiado
  (mesmo e-mail e senha), campos do módulo Acertos dele recriados na viagem do Frota (detalhes no SITUACAO.md do Frota).
  Falta: conferir pelo painel e avisar o Ducairo.
- **Assistente em todos os apps — feito em 03/11/2026** (núcleo `core/assistente.js` + função `assistente` + `fabrica.sql`):
  ✦ e botão + em cada tela no Frota, Golden e Mil Terras. Falta (dono): rodar o trecho "Assistente" do `fabrica.sql`, gravar
  `ANTHROPIC_API_KEY` nos Secrets do easyapp-fabrica e o `SUPABASE_ACCESS_TOKEN` no GitHub do EasyAPP-Base (publica a função).
  Próximo passo: carteira de créditos / Mercado Pago (hoje é limite mensal por empresa) e o uso por empresa no painel de gestão.
- Token do Supabase no ambiente do Claude: desde 03/11 enxerga a Fábrica e o easyapp-store (Financial).
