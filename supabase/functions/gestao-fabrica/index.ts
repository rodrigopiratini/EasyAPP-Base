// Gestão da fábrica: o painel de gestão do EasyApp Financial enxerga e atende as empresas de todos os apps
// (Mil Terras, Frota, Golden…), que moram no projeto easyapp-fabrica, cada app na sua pasta (schema).
//
// Quem chama é a função "gestao" do Financial (servidor para servidor), que já conferiu o login do dono
// com o código do autenticador. Aqui só se confere o segredo compartilhado FABRICA_SEGREDO.
// Publicar SEM verificação de JWT:  supabase functions deploy gestao-fabrica --no-verify-jwt
// Segredos: FABRICA_SEGREDO (o mesmo cadastrado na função gestao do Financial). SUPABASE_URL,
// SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY já existem.
//
// Push (Web Push) para o dono da plataforma: { op: 'push_chave' | 'push_inscrever' | 'push_remover' | 'push_testar' } (pelo painel)
// e { op: 'avisar_acesso' } (chamada pelo banco, com o x-aviso-segredo de fabrica_config). Chaves VAPID em fabrica_config.
// Ações (POST, JSON): { op: 'listar' } · { op: 'pessoas', pasta, empresa, dias } · { op: 'assinatura', pasta, empresa, situacao, plano, testeAte, pagoAte, valor, obs }
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

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

async function config() {
  const { data } = await adm.from('fabrica_config').select('chave,valor');
  return Object.fromEntries((data || []).map((x: any) => [x.chave, x.valor]));
}
const igual = (a: string, b: string) => { if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
// manda para todos os aparelhos inscritos; os que não existem mais (404/410) saem da lista
async function enviarPush(cfg: Record<string, string>, aviso: { title: string; body: string; url?: string; tag?: string }) {
  webpush.setVapidDetails(cfg.vapid_assunto || 'https://easyappfinancial.com.br', cfg.vapid_publica, cfg.vapid_privada);
  const { data: subs } = await adm.from('fabrica_push').select('endpoint,p256dh,auth');
  let ok = 0, falhas = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(aviso), { TTL: 3600, urgency: 'normal' });
      ok++; await adm.from('fabrica_push').update({ ultimo_envio: new Date().toISOString() }).eq('endpoint', s.endpoint);
    } catch (e: any) {
      falhas++;
      if (e?.statusCode === 404 || e?.statusCode === 410) await adm.from('fabrica_push').delete().eq('endpoint', s.endpoint);
      else console.warn('push', e?.statusCode, e?.body || e?.message);
    }
  }
  return { enviados: ok, falhas, aparelhos: (subs || []).length };
}
const PAPEL: Record<string, string> = { dono: 'administrador', gestor: 'gestor', usuario: 'usuário' };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ erro: 'use POST' }, 405);
  let b: any = {};
  try { b = await req.clone().json(); } catch { /* vazio */ }
  // aviso de acesso: quem chama é o próprio banco (pg_net), com o segredo guardado em fabrica_config
  if (b.op === 'avisar_acesso') {
    const cfg = await config();
    if (!igual(cfg.aviso_segredo || '', req.headers.get('x-aviso-segredo') || '')) return json({ erro: 'sem permissão' }, 401);
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    const r = await enviarPush(cfg, { title: `${b.quem || 'Alguém'} entrou no ${b.app || 'app'}`, body: `${b.empresa || ''}${b.papel ? ' · ' + (PAPEL[b.papel] || b.papel) : ''} · ${hora}`, url: 'https://easyappfinancial.com.br/gestao.html', tag: 'acesso-' + (b.quem || '') });
    return json({ ok: true, ...r });
  }
  if (!segredoOk(req)) return json({ erro: 'sem permissão' }, 401);

  if (b.op === 'push_chave') { const cfg = await config(); return json({ ok: true, chave: cfg.vapid_publica }); }
  if (b.op === 'push_inscrever') {
    const s = b.sub || {};
    if (!s.endpoint || !s.keys?.p256dh || !s.keys?.auth) return json({ erro: 'inscrição inválida' });
    const { error } = await adm.from('fabrica_push').upsert({ endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, quem: String(b.quem || '') });
    return json(error ? { erro: error.message } : { ok: true });
  }
  if (b.op === 'push_remover') { await adm.from('fabrica_push').delete().eq('endpoint', String(b.endpoint || '')); return json({ ok: true }); }
  if (b.op === 'push_testar') {
    const r = await enviarPush(await config(), { title: 'EasyAPP Gestão', body: 'Teste: os avisos de acesso estão chegando neste aparelho.', url: 'https://easyappfinancial.com.br/gestao.html', tag: 'teste' });
    return json({ ok: true, ...r });
  }

  if (b.op === 'listar') {
    const { data, error } = await adm.rpc('fabrica_empresas');
    return error ? json({ erro: error.message }) : json({ ok: true, empresas: data });
  }

  // quem entra na empresa (e se está conectado agora) e o registro do que cada um fez
  if (b.op === 'pessoas') {
    const { data, error } = await adm.rpc('fabrica_pessoas', { p_pasta: String(b.pasta || ''), p_empresa: b.empresa || null, p_dias: Math.min(365, Math.max(1, Number(b.dias) || 60)) });
    return error ? json({ erro: error.message }) : json({ ok: true, ...data });
  }

  if (b.op === 'assinatura') {
    const { error } = await adm.rpc('fabrica_atualizar', { p_pasta: String(b.pasta || ''), p_empresa: b.empresa, p_situacao: b.situacao,
      p_plano: b.plano || null, p_teste_ate: b.testeAte || null, p_pago_ate: b.pagoAte || null, p_valor: b.valor ?? null, p_obs: b.obs || null });
    return json(error ? { erro: error.message } : { ok: true });
  }

  return json({ erro: 'ação desconhecida' }, 400);
});
