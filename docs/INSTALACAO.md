# Colocar um app de segmento no ar (uma vez por segmento, ~15 minutos)

Um único banco atende **todas as empresas** do segmento (cada uma só enxerga o que é dela).
Ou seja: isto é feito uma vez por segmento, não por cliente.

## 1. Publicar o site (GitHub Pages)
1. No GitHub, abra o repositório › **Settings** › **Pages** › **Build and deployment › Source: GitHub Actions**.
2. A cada push na `main` o site é publicado sozinho em `https://<usuário>.github.io/<repositório>/`
   - Gestão: `…/gestao/` · App do usuário: `…/usuario/` · Demonstração: `…/gestao/?demo=1` e `…/usuario/?demo=1`
3. (Opcional) Endereço próprio, ex.: `frota.easyappfinancial.com.br`: crie um registro **CNAME** no DNS apontando para
   `<usuário>.github.io`, crie o arquivo `CNAME` na raiz do repositório com o endereço e confirme em Settings › Pages › Custom domain.

## 2. Criar o banco (Supabase)
1. https://supabase.com › **New project** · nome = id do segmento · região **South America (São Paulo)** · anote a senha.
2. **SQL Editor › New query**: cole todo o [`supabase/instalar.sql`](../supabase/instalar.sql) › **Run** (aparece "Instalação concluída").
3. **Authentication › Sign In / Providers**: ative **Allow anonymous sign-ins** (é assim que o app do usuário entra com código + PIN).
4. **Authentication › URL Configuration › Site URL**: o endereço da Gestão (ex.: `https://…/gestao/`).
5. **Project Settings › API**: copie a **Project URL** e a **Publishable key** (ou "anon public") para [`src/js/config.js`](../src/js/config.js).
   ⚠️ Nunca use a chave `service_role`/`secret` no app.

## 3. Você como administrador da plataforma
Coloque seu e-mail em `plataforma.admins` no `src/js/segmento.js`, rode `node supabase/gerar.mjs` e rode o `instalar.sql` de novo
(ou, direto no SQL Editor: `insert into plataforma_admins values ('seu@email.com');`).
Na Gestão aparece o menu **Plataforma**: todas as empresas, situação (teste / ativa / suspensa), vencimento, uso e receita mensal.

## 4. Primeiro cliente
1. O cliente abre a Gestão › **Criar conta** (e-mail e senha) › **Criar minha empresa**: começa o período de teste.
2. Ele cadastra a equipe e, em **Configurações › Acesso**, gera código + PIN de cada usuário e envia pelo WhatsApp.
3. Sócios/escritório: **Configurações › Equipe de gestão › Convidar gestor** (código de uso único, 7 dias).

## Cobrança (assinatura)
- Em **Plataforma**, ao receber o pagamento, mude a empresa para **Ativa**, escolha o plano, o valor e **Pago até**.
- Teste vencido, ou ativa com "pago até" vencido há mais de 5 dias: o banco **recusa gravações** e o app mostra o aviso.
  Os dados continuam visíveis e exportáveis (nada é apagado).
- Suspender: situação **Suspensa**. Reativar: **Ativa** com nova data.

## Atualizações do banco
Sempre que o `instalar.sql` mudar, cole-o inteiro de novo no SQL Editor › **Run**. É seguro: não apaga dados.

## Bom saber
- **Plano gratuito do Supabase**: 2 projetos por conta e pausa após 7 dias sem acesso. Com clientes pagando, use o **Pro**
  (US$ 25/mês por organização, cada projeto extra ~US$ 10/mês); confira os preços atuais em supabase.com/pricing.
- **Sem internet**: as alterações ficam na fila do aparelho e são enviadas quando a conexão voltar.
- **Registro de atividades**: Gestão › Atividade (só o dono). Gravado pelo banco, guarda 1 ano.
