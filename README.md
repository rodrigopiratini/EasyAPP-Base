# EasyApp Base — molde da fábrica de apps por segmento

Ponto de partida de cada app de segmento (frota, distribuição, serviços em campo…): **dois apps PWA**
(Gestão + Usuário) sobre **um banco Supabase com várias empresas**, cadastro com período de teste,
assinatura, acessos por código + PIN, registro de atividades, funcionamento offline e publicação automática.

- Como criar um segmento novo e o modelo comercial: [`docs/FABRICA.md`](docs/FABRICA.md)
- Como colocar no ar (GitHub Pages + Supabase): [`docs/INSTALACAO.md`](docs/INSTALACAO.md)

O exemplo que acompanha o molde é um app de **ordens de serviço** (Gestão + Técnico).

## Rodar localmente
Sem build nem dependências: HTML, CSS e JavaScript puro.
```bash
python3 -m http.server 8080
```
Abra http://localhost:8080 · Gestão demo: `/gestao/?demo=1` (PIN `0000`) · Técnico demo: `/usuario/?demo=1` (código `CARLOS`, PIN `1234`).

## Estrutura
```
index.html, gestao/, usuario/    páginas (geradas/ajustadas por scripts/aplicar-segmento.mjs)
src/js/segmento.js               ★ definição do segmento: nome, planos, usuário, coleções e regras de acesso
src/js/dominio.js                ★ regras do negócio
src/js/gestao/app.js             ★ telas da Gestão
src/js/usuario/app.js            ★ telas do app do usuário
src/js/seed.js                   ★ dados de demonstração
src/css/segmento.css             ★ cores da marca
src/js/core/                     núcleo comum (não editar no segmento; vem do molde)
  app.js       login, empresa, equipe, acessos, assinatura, atividade, plataforma, navegação
  store.js     dados: nuvem (Supabase) ou local (demonstração)   cloud.js  sincronização e fila offline
  form.js      cadastros a partir de listas de campos            ui.js, charts.js, fmt.js
supabase/base.sql                banco comum (empresas, documentos, regras, assinatura, atividade)
supabase/segmento.sql            ★ regras extras do segmento (opcional)
supabase/gerar.mjs               gera supabase/instalar.sql (o arquivo que se cola no Supabase)
scripts/                         novo-segmento.sh · atualizar-base.sh · aplicar-segmento.mjs
```
★ = o que muda de um segmento para outro.
