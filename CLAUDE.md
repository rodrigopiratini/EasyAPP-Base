# EasyApp Base — instruções para o Claude

- Este repositório é o **molde** da fábrica de apps por segmento (veja `docs/FABRICA.md`). Melhorias no núcleo
  (`src/js/core/`, `supabase/base.sql`, `sw.js`, workflow) valem para todos os segmentos: depois de mudar aqui, leve para
  cada segmento com `bash scripts/atualizar-base.sh ../<segmento>` e publique lá também.
- Não coloque regra de um segmento específico no núcleo; use `segmento.js`, `dominio.js`, as telas e `supabase/segmento.sql`.
- Banco: depois de mudar `base.sql`, `segmento.sql` ou as coleções do `segmento.js`, rode `node supabase/gerar.mjs`
  (gera o `instalar.sql`, que o dono cola no SQL Editor do Supabase; é idempotente). Teste o SQL num PostgreSQL local antes.
- Nome, cores ou ícone mudaram: `node scripts/aplicar-segmento.mjs`.
- **Sempre publicar**: commit, push na branch de trabalho e na `main` (o Pages publica a partir da `main`).
- Nunca coloque e-mail, telefone ou chave secreta em arquivo do repositório (os repositórios podem ser públicos).
