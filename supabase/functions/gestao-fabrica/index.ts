// Gestão da fábrica: o painel de gestão do EasyApp Financial enxerga e atende as empresas de todos os apps
// (Mil Terras, Frota, Golden…), que moram no projeto easyapp-fabrica, cada app na sua pasta (schema).
//
// Quem chama é a função "gestao" do Financial (servidor para servidor), que já conferiu o login do dono
// com o código do autenticador. Aqui só se confere o segredo compartilhado FABRICA_SEGREDO.
// Publicar SEM verificação de JWT:  supabase functions deploy gestao-fabrica --no-verify-jwt
// Segredos: FABRICA_SEGREDO (o mesmo cadastrado na função gestao do Financial). SUPABASE_URL,
// SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY já existem.
//
// Ações (POST, JSON): { op: 'listar' } · { op: 'abrir_como', pasta, empresa, modo, quem } · { op: 'assinatura', pasta, empresa, situacao, plano, testeAte, pagoAte, valor, obs }
import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const adm = createClient(URL_SB, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

function segredoOk(req: Request) {
  const s = Deno.env.get('FABRICA_SEGREDO') || '';
  const h = req.headers.get('x-fabrica-segredo') || '';
  if (s.length < 24 || h.length !== s.length) return false;
  let d = 0; for (let i = 0; i < s.length; i++) d |= s.charCodeAt(i) ^ h.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ erro: 'use POST' }, 405);
  if (!segredoOk(req)) return json({ erro: 'sem permissão' }, 401);
  let b: any = {};
  try { b = await req.json(); } catch { /* vazio */ }

  if (b.op === 'listar') {
    const { data, error } = await adm.rpc('fabrica_empresas');
    return error ? json({ erro: error.message }) : json({ ok: true, empresas: data });
  }

  if (b.op === 'abrir_como') {
    const pasta = String(b.pasta || ''), modo = b.modo === 'edicao' ? 'edicao' : 'leitura';
    const { data: email, error: e1 } = await adm.rpc('fabrica_dono', { p_pasta: pasta, p_empresa: b.empresa || null });
    if (e1 || !email) return json({ erro: e1?.message || 'esta empresa ainda não tem dono com e-mail' });
    // link de acesso gerado pelo próprio Supabase (não envia e-mail, não mexe na senha), trocado aqui por uma sessão
    const { data: lk, error: eL } = await adm.auth.admin.generateLink({ type: 'magiclink', email });
    const hash = (lk as any)?.properties?.hashed_token;
    if (eL || !hash) return json({ erro: 'não consegui gerar o acesso: ' + (eL?.message || '') });
    const rv = await fetch(URL_SB + '/auth/v1/verify', { method: 'POST',
      headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY')!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'magiclink', token_hash: hash }) });
    const sv = await rv.json().catch(() => ({}));
    if (!rv.ok || !sv.access_token) return json({ erro: 'o acesso foi recusado: ' + (sv.msg || sv.error_description || rv.status) });
    await adm.rpc('fabrica_registrar_suporte', { p_pasta: pasta, p_empresa: b.empresa || null, p_quem: String(b.quem || 'painel'), p_modo: modo });
    const { data: app } = await adm.from('fabrica_apps').select('url_gestao,nome').eq('pasta', pasta).maybeSingle();
    return json({ ok: true, email, modo, url: app?.url_gestao, app: app?.nome,
      sessao: { access_token: sv.access_token, refresh_token: sv.refresh_token, expires_in: sv.expires_in } });
  }

  if (b.op === 'assinatura') {
    const { error } = await adm.rpc('fabrica_atualizar', { p_pasta: String(b.pasta || ''), p_empresa: b.empresa, p_situacao: b.situacao,
      p_plano: b.plano || null, p_teste_ate: b.testeAte || null, p_pago_ate: b.pagoAte || null, p_valor: b.valor ?? null, p_obs: b.obs || null });
    return json(error ? { erro: error.message } : { ok: true });
  }

  return json({ erro: 'ação desconhecida' }, 400);
});
