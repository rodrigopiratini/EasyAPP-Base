# Fábrica de apps por segmento

O `easyapp-base` é o molde. Cada segmento (frota, distribuição de vinhos, serviços em campo…) é um
repositório criado a partir dele, com **um** banco Supabase que atende todas as empresas daquele segmento.

## O que já vem pronto (não reescreva)
| Peça | Onde |
|---|---|
| Dois apps PWA (Gestão + Usuário), instaláveis no iPhone/Android, funcionam sem internet | `gestao/`, `usuario/`, `sw.js` |
| Várias empresas no mesmo banco, cada uma isolada | `supabase/base.sql` |
| Cadastro livre do dono com período de teste, convite de gestores, login do usuário por código + PIN | `src/js/core/app.js` |
| Assinatura: teste / ativa / suspensa, bloqueio de gravações quando vence, painel **Plataforma** | `base.sql` + `core/app.js` |
| Registro de atividades (quem fez o quê) | `base.sql` + `core/app.js` |
| Sincronização em tempo real e fila offline | `src/js/core/cloud.js`, `store.js` |
| Modo demonstração com dados fictícios (`?demo=1`) | `src/js/seed.js` |
| Cadastros a partir de uma lista de campos (`editar({...})`) | `src/js/core/form.js` |
| Componentes (cartões, KPIs, gráficos, modais, WhatsApp, CSV, impressão) | `src/js/core/ui.js`, `charts.js` |
| Publicação automática + aviso "Nova versão · Atualizar" | `.github/workflows/pages.yml` |

## O que cada segmento escreve
1. `src/js/segmento.js`: nome, cores do ícone, planos, quem é o usuário (motorista, parceiro, técnico) e as **coleções** com as regras de acesso.
2. `src/css/segmento.css`: as cores da marca.
3. `src/js/dominio.js`: as regras e os cálculos do negócio.
4. `src/js/gestao/app.js` e `src/js/usuario/app.js`: as telas.
5. `src/js/seed.js`: dados de demonstração (é o que se mostra na venda).
6. `supabase/segmento.sql`: só se precisar de regra extra no banco (gatilho, função).

## Receita: segmento novo em 1–2 dias
1. **Repositório**: crie um repositório vazio no GitHub (ex.: `easyapp-vinhos`) e rode
   `bash scripts/novo-segmento.sh ../easyapp-vinhos` a partir do `easyapp-base` (copia o molde).
2. **Definição**: escreva o `segmento.js` (coleções e regras) e o `segmento.css`; rode `node scripts/aplicar-segmento.mjs` (títulos, manifests, ícones).
3. **Telas e demonstração**: `dominio.js`, `gestao/app.js`, `usuario/app.js`, `seed.js`. Teste com `python3 -m http.server` em `?demo=1`.
4. **Banco**: `node supabase/gerar.mjs` › crie o projeto no Supabase › cole o `instalar.sql` (passo a passo em `docs/INSTALACAO.md`).
5. **No ar**: preencha `src/js/config.js`, push na `main`, ative o Pages.
6. **Venda**: mostre a demonstração; o cliente cria a conta sozinho e entra em teste.

## Regras de acesso das coleções (resumo)
```js
colecoes: {
  veiculos:  { nome: 'Veículos', leitura: 'todos' },                           // gestão grava; usuários leem
  motoristas:{ nome: 'Motoristas', leitura: 'proprio', ref: 'id' },            // cada motorista vê só o próprio cadastro
  viagens:   { nome: 'Viagens', leitura: 'proprio', escrita: 'proprio', ref: 'motoristaId',
               protegidos: ['valorFrete'], trava: 'conferido' },             // motorista lança as dele, não mexe no valor,
}                                                                              // e não altera depois de conferido
```
- `leitura`: `gestao` (só a gestão) · `todos` (gestão + usuários da empresa) · `proprio` (o usuário só vê os seus)
- `escrita`: `gestao` · `proprio`
- `ref`: campo que diz a quem pertence; `'id'` = o próprio documento (o cadastro do usuário)
- `protegidos`: campos que o usuário não consegue alterar (o banco mantém o valor anterior)
- `trava`: campo booleano; quando `true` o usuário não altera nem apaga mais

## Atualizar o núcleo de um segmento já criado
Melhorias no molde (`core/`, `base.sql`, `sw.js`, workflow) são levadas para um segmento com
`bash scripts/atualizar-base.sh ../easyapp-frota` (não toca nas telas nem no `segmento.js`). Depois: `node supabase/gerar.mjs` e rodar o `instalar.sql`.

## Modelo comercial (sugestão)
- **Implantação** (cobrada uma vez): importar dados, configurar, treinar. Ex.: R$ 500–1.500.
- **Mensalidade por empresa** em faixas (pelo número de usuários/veículos), cadastrada em `segmento.js › planos`.
- **Pedidos de mudança**: o que serve ao segmento entra para todos sem custo (é o roteiro do produto);
  o que só serve àquele cliente vira orçamento à parte. Plano maior pode incluir algumas horas por mês.
- **Primeiro cliente de cada segmento** (o "parceiro de lançamento"): desconto em troca de opinião e indicações;
  cada indicação que vira cliente = 1 mês grátis ou comissão recorrente.
- **Cobrança**: hoje manual pelo painel **Plataforma** (Pix/boleto e marca "pago até").
  Próximo passo: assinatura automática pelo Mercado Pago (o EasyApp Financial já tem a integração `mp-aviso`).
