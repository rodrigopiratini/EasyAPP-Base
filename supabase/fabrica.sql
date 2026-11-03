-- =====================================================================
-- EasyAPP Fábrica — funções do painel de gestão (projeto easyapp-fabrica, uma vez por projeto).
-- Chamadas SÓ pela função gestao-fabrica (chave de serviço); ninguém mais pode executar.
-- Juntam as empresas de todas as pastas (apps) do projeto para o painel de gestão do Financial.
-- Pode rodar de novo sem perder dados.
-- =====================================================================

-- Apps da fábrica: pasta no banco, nome e endereço (o painel usa para abrir o app como o cliente)
create table if not exists public.fabrica_apps (
  pasta text primary key,
  nome text not null,
  url_gestao text not null,
  multiempresa boolean not null default true    -- false = app de um cliente só (ex.: Mil Terras)
);
alter table public.fabrica_apps enable row level security;
revoke all on public.fabrica_apps from anon, authenticated;
insert into public.fabrica_apps (pasta, nome, url_gestao, multiempresa) values
  ('milterras', 'Mil Terras', 'https://rodrigopiratini.github.io/MilTerras/gestor/', false),
  ('frota', 'EasyApp Frota', 'https://rodrigopiratini.github.io/EasyAPP-Frota/gestao/', true),
  ('golden', 'Golden CRM', 'https://rodrigopiratini.github.io/Golden/gestao/', true)
on conflict (pasta) do update set nome = excluded.nome, url_gestao = excluded.url_gestao, multiempresa = excluded.multiempresa;

-- Todas as empresas de todos os apps, com dono, uso e assinatura
create or replace function public.fabrica_empresas() returns json
language plpgsql stable security definer set search_path = public as $$
declare a record; out jsonb := '[]'::jsonb; parte jsonb;
begin
  for a in select * from public.fabrica_apps order by nome loop
    if not exists (select 1 from information_schema.schemata where schema_name = a.pasta) then continue; end if;
    if a.multiempresa then
      execute format($q$
        select coalesce(jsonb_agg(jsonb_build_object(
          'app', %L, 'appNome', %L, 'url', %L, 'id', e.id, 'nome', e.nome, 'situacao', e.situacao, 'plano', e.plano,
          'testeAte', e.teste_ate, 'pagoAte', e.pago_ate, 'valorMensal', e.valor_mensal, 'obs', e.obs, 'criadoEm', e.criado_em,
          'liberada', %I.empresa_liberada(e.id),
          'dono', (select u.email from %I.perfis p join auth.users u on u.id = p.user_id where p.empresa_id = e.id and p.papel = 'dono' limit 1),
          'gestores', (select count(*) from %I.perfis p where p.empresa_id = e.id and p.papel in ('dono', 'gestor')),
          'usuarios', (select count(*) from %I.acessos x where x.empresa_id = e.id and x.ativo),
          'registros', (select count(*) from %I.docs d where d.empresa_id = e.id),
          'ultimoUso', (select max(em) from %I.atividade t where t.empresa_id = e.id),
          'online', (select count(*) from %I.perfis p where p.empresa_id = e.id and p.visto_em > now() - interval '3 minutes')) order by e.criado_em), '[]'::jsonb)
        from %I.empresas e$q$, a.pasta, a.nome, a.url_gestao, a.pasta, a.pasta, a.pasta, a.pasta, a.pasta, a.pasta, a.pasta, a.pasta) into parte;
    else
      execute format($q$
        select jsonb_build_array(jsonb_build_object('app', %L, 'appNome', %L, 'url', %L, 'id', null, 'nome', %L, 'situacao', 'ativa', 'liberada', true,
          'dono', (select u.email from %I.perfis p join auth.users u on u.id = p.user_id where p.papel = 'dono' limit 1),
          'gestores', (select count(*) from %I.perfis p where p.papel in ('dono', 'gestor')),
          'usuarios', (select count(*) from %I.perfis p where p.papel not in ('dono', 'gestor')),
          'ultimoUso', (select max(em) from %I.atividade),
          'online', (select count(distinct user_id) from %I.atividade where em > now() - interval '5 minutes')))$q$, a.pasta, a.nome, a.url_gestao, a.nome, a.pasta, a.pasta, a.pasta, a.pasta, a.pasta) into parte;
    end if;
    out := out || coalesce(parte, '[]'::jsonb);
  end loop;
  return out::json;
end $$;

-- Assinatura de uma empresa (apps com várias empresas)
create or replace function public.fabrica_atualizar(p_pasta text, p_empresa uuid, p_situacao text, p_plano text, p_teste_ate date, p_pago_ate date, p_valor numeric, p_obs text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.fabrica_apps where pasta = p_pasta and multiempresa) then raise exception 'App desconhecido'; end if;
  execute format('update %I.empresas set situacao = $1, plano = coalesce(nullif(trim($2), %L), plano), teste_ate = coalesce($3, teste_ate), pago_ate = $4, valor_mensal = $5, obs = nullif(trim($6), %L) where id = $7', p_pasta, '', '')
    using p_situacao, p_plano, p_teste_ate, p_pago_ate, p_valor, p_obs, p_empresa;
end $$;

-- E-mail do dono (para abrir o app como ele) e registro do acesso de suporte no histórico da empresa
create or replace function public.fabrica_dono(p_pasta text, p_empresa uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare v text; m boolean;
begin
  select multiempresa into m from public.fabrica_apps where pasta = p_pasta;
  if m is null then raise exception 'App desconhecido'; end if;
  if m then execute format('select u.email from %I.perfis p join auth.users u on u.id = p.user_id where p.empresa_id = $1 and p.papel = %L limit 1', p_pasta, 'dono') into v using p_empresa;
  else execute format('select u.email from %I.perfis p join auth.users u on u.id = p.user_id where p.papel = %L limit 1', p_pasta, 'dono') into v; end if;
  return v;
end $$;

create or replace function public.fabrica_registrar_suporte(p_pasta text, p_empresa uuid, p_quem text, p_modo text) returns void
language plpgsql security definer set search_path = public as $$
declare m boolean;
begin
  select multiempresa into m from public.fabrica_apps where pasta = p_pasta;
  if m is null then return; end if;
  begin
    if m then execute format('insert into %I.atividade (empresa_id, papel, quem, acao, depois) values ($1, %L, $2, %L, $3)', p_pasta, 'suporte', 'acesso')
              using p_empresa, 'Suporte (' || p_quem || ')', jsonb_build_object('modo', p_modo);
    else execute format('insert into %I.atividade (papel, quem, acao, depois) values (%L, $1, %L, $2)', p_pasta, 'suporte', 'acesso')
              using 'Suporte (' || p_quem || ')', jsonb_build_object('modo', p_modo); end if;
  exception when others then raise warning 'registrar suporte: %', sqlerrm;
  end;
end $$;

-- Pessoas de uma empresa (quem entra, papel, se está conectado agora) e o que cada uma fez (registro de atividades)
--   conectado = o app mandou sinal nos últimos 3 minutos (perfis.visto_em); no Mil Terras, ação nos últimos 5 minutos
create or replace function public.fabrica_pessoas(p_pasta text, p_empresa uuid, p_dias int default 60) returns json
language plpgsql stable security definer set search_path = public as $$
declare m boolean; pessoas json; itens json;
begin
  select multiempresa into m from public.fabrica_apps where pasta = p_pasta;
  if m is null then raise exception 'App desconhecido'; end if;
  if m then
    execute format($q$
      select coalesce(json_agg(x order by x.online desc, x.visto desc nulls last), '[]') from (
        select p.user_id "userId", p.papel, p.ref, case when coalesce(u.is_anonymous, false) then null else u.email end email,
               coalesce(a.nome, u.email) nome, a.codigo, p.visto_em visto, coalesce(p.visto_em > now() - interval '3 minutes', false) online,
               (select max(t.em) from %I.atividade t where t.user_id = p.user_id) "ultimaAcao",
               (select count(*) from %I.atividade t where t.user_id = p.user_id and t.acao <> 'acesso' and t.em > now() - make_interval(days => $2)) acoes
        from %I.perfis p left join auth.users u on u.id = p.user_id left join %I.acessos a on a.empresa_id = p.empresa_id and a.ref = p.ref and p.papel = 'usuario'
        where p.empresa_id = $1
        union all  -- acesso de campo criado que ainda não foi usado
        select null, 'usuario', a.ref, null, a.nome, a.codigo, null, false, null, 0 from %I.acessos a
        where a.empresa_id = $1 and a.ativo and not exists (select 1 from %I.perfis p where p.empresa_id = a.empresa_id and p.ref = a.ref and p.papel = 'usuario')) x$q$,
      p_pasta, p_pasta, p_pasta, p_pasta, p_pasta, p_pasta) into pessoas using p_empresa, p_dias;
    execute format($q$
      select coalesce(json_agg(x order by x.em desc), '[]') from (
        select t.em, t.user_id "userId", t.papel, t.quem, t.acao, t.colecao, t.registro, case when t.acao = 'delete' then t.antes else t.depois end dados,
               (select d.data from %I.docs d where d.empresa_id = t.empresa_id and d.id = t.registro limit 1) atual
        from %I.atividade t where t.empresa_id = $1 and t.em > now() - make_interval(days => $2) order by t.em desc limit 1500) x$q$, p_pasta, p_pasta)
      into itens using p_empresa, p_dias;
  else
    execute format($q$
      select coalesce(json_agg(x order by x.online desc, x.visto desc nulls last), '[]') from (
        select p.user_id "userId", p.papel, null ref, u.email, u.email nome, null codigo, v.visto, coalesce(v.visto > now() - interval '5 minutes', false) online, v.visto "ultimaAcao", v.acoes
        from %I.perfis p left join auth.users u on u.id = p.user_id
        left join lateral (select max(t.em) visto, count(*) filter (where t.acao <> 'acesso' and t.em > now() - make_interval(days => $1)) acoes from %I.atividade t where t.user_id = p.user_id) v on true) x$q$,
      p_pasta, p_pasta) into pessoas using p_dias;
    execute format($q$
      select coalesce(json_agg(x order by x.em desc), '[]') from (
        select t.em, t.user_id "userId", t.papel, t.quem, t.acao, t.tabela colecao, t.registro, coalesce(t.depois, t.antes) dados, null::jsonb atual
        from %I.atividade t where t.em > now() - make_interval(days => $1) order by t.em desc limit 1500) x$q$, p_pasta) into itens using p_dias;
  end if;
  return json_build_object('pessoas', pessoas, 'itens', itens);
end $$;

do $$ declare f text; begin
  foreach f in array array['fabrica_pessoas(text, uuid, int)', 'fabrica_empresas()', 'fabrica_atualizar(text, uuid, text, text, date, date, numeric, text)', 'fabrica_dono(text, uuid)', 'fabrica_registrar_suporte(text, uuid, text, text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

select json_array_length(public.fabrica_empresas()) as "empresas encontradas";
