// Adaptador Supabase (comum a todos os segmentos): carrega os documentos que o usuário pode ver
// (as regras ficam no banco), grava o que o app alterou (diferença antes/depois de cada commit)
// e recebe as mudanças dos outros aparelhos em tempo real.
// Gravações passam por uma fila persistente: se a internet cair, são reenviadas depois.

import { CONFIG } from '../config.js';
import { SEGMENTO } from '../segmento.js';

const COLECOES = Object.keys(SEGMENTO.colecoes);
const PAGINA = 1000;
const LOTE = 200;
const SCHEMA = SEGMENTO.schema || 'public'; // pasta do app no banco (vários apps no mesmo projeto)

export function criarNuvem(app, hooks) {
  // Modo suporte: o painel de gestão abre o app como o cliente passando o acesso em #suporte=… .
  // Essa sessão fica só nesta aba (sessionStorage) e não substitui o login de quem usa o navegador.
  const SUP_KEY = `${SEGMENTO.id}-suporte-${app}`;
  let suporte = null;
  try {
    const h = new URLSearchParams(location.hash.startsWith('#suporte=') ? location.hash.slice(1) : '');
    if (h.get('suporte')) {
      const d = JSON.parse(decodeURIComponent(escape(atob(h.get('suporte')))));
      sessionStorage.setItem(SUP_KEY, JSON.stringify(d));
      history.replaceState(null, '', location.pathname + location.search + '#/');
    }
    suporte = JSON.parse(sessionStorage.getItem(SUP_KEY) || 'null');
  } catch { suporte = null; }
  const sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
    db: { schema: SCHEMA },
    auth: suporte
      ? { storageKey: SUP_KEY + '-auth', storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      : { storageKey: `${SEGMENTO.id}-auth-${app}`, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  const OUTBOX = suporte ? SUP_KEY + '-fila' : `${SEGMENTO.id}-fila-${app}`;
  let state = null;
  let perfil = null;
  let snap = {};
  let canal = null;
  let enviando = false;
  let fila = lerFila();
  let status = 'online';
  const empresa = () => perfil?.empresaId;
  const ehGestao = () => perfil?.papel === 'dono' || perfil?.papel === 'gestor';

  function lerFila() { try { return JSON.parse(localStorage.getItem(OUTBOX) || '[]'); } catch { return []; } }
  function salvarFila() { try { localStorage.setItem(OUTBOX, JSON.stringify(fila)); } catch {} }
  const setStatus = (s) => { if (s !== status) { status = s; hooks.onStatus?.(s, fila.length); } };

  async function buscarTudo() {
    const out = [];
    for (let de = 0; ; de += PAGINA) {
      const { data, error } = await sb.from('docs').select('id,colecao,data').eq('empresa_id', empresa()).order('id').range(de, de + PAGINA - 1);
      if (error) throw error;
      out.push(...data);
      if (data.length < PAGINA) return out;
    }
  }

  function fotografar() {
    snap = { meta: JSON.stringify(state.meta) };
    for (const c of COLECOES) snap[c] = new Map(state[c].map((x) => [x.id, JSON.stringify(x)]));
  }

  async function carregar() {
    const docs = await buscarTudo();
    state = { meta: { demo: false } };
    for (const c of COLECOES) state[c] = [];
    for (const d of docs) {
      if (d.colecao === 'config') { if (d.id === 'geral') state.meta = { ...d.data, demo: false }; }
      else if (state[d.colecao]) state[d.colecao].push(d.data);
    }
    state.meta.empresa ||= perfil.empresa?.nome || '';
    for (const op of fila) aplicarLocal(op); // o que ainda não foi enviado prevalece sobre o servidor
    fotografar();
    return state;
  }

  function aplicarLocal(op) {
    if (op.colecao === 'config') { if (op.op !== 'delete') state.meta = { ...state.meta, ...op.data }; return; }
    const arr = state[op.colecao];
    if (!arr) return;
    const i = arr.findIndex((x) => x.id === op.id);
    if (op.op === 'delete') { if (i >= 0) arr.splice(i, 1); return; }
    if (i >= 0) arr[i] = op.data; else arr.push(op.data);
  }

  // Compara o estado com a última fotografia e enfileira o que mudou
  function registrarMudancas() {
    const ops = [];
    for (const c of COLECOES) {
      const atual = new Map(state[c].map((x) => [x.id, x]));
      for (const [id, doc] of atual) if (snap[c].get(id) !== JSON.stringify(doc)) ops.push({ colecao: c, op: 'upsert', id, data: doc });
      for (const id of snap[c].keys()) if (!atual.has(id)) ops.push({ colecao: c, op: 'delete', id });
    }
    if (JSON.stringify(state.meta) !== snap.meta && ehGestao()) { const { demo, ...data } = state.meta; ops.push({ colecao: 'config', op: 'upsert', id: 'geral', data }); }
    fotografar();
    if (ops.length) { fila.push(...ops.map((o) => ({ ...o, empresa: empresa() }))); salvarFila(); enviar(); }
  }

  const linha = (op) => ({ empresa_id: op.empresa, id: op.id, colecao: op.colecao, data: op.data });
  async function enviar() {
    if (enviando || !fila.length) { if (!fila.length) setStatus('online'); return; }
    enviando = true;
    setStatus('enviando');
    try {
      while (fila.length) {
        const op = fila[0];
        let lote = [op];
        if (op.op === 'upsert') { lote = []; for (const x of fila) { if (x.op !== 'upsert' || x.empresa !== op.empresa || lote.length >= LOTE || lote.some((y) => y.id === x.id)) break; lote.push(x); } }
        let r;
        try {
          r = op.op === 'upsert'
            ? await sb.from('docs').upsert(lote.map(linha), { onConflict: 'empresa_id,id' })
            : await sb.from('docs').delete().eq('empresa_id', op.empresa).eq('id', op.id);
        } catch (e) { r = { error: { rede: true, message: e.message } }; }
        if (r.error) {
          const rede = r.error.rede || !r.error.code || /fetch|network|Failed/i.test(r.error.message || '');
          if (rede) { setStatus('offline'); setTimeout(() => { enviando = false; enviar(); }, 15000); return; }
          // recusado pelo banco (permissão/regra): descarta e recarrega a verdade do servidor
          console.warn('Gravação recusada', op, r.error);
          fila.splice(0, lote.length); salvarFila();
          hooks.onErro?.(traduzir(r.error.message));
          await carregar();
          hooks.onChange?.('recarregado', true);
          continue;
        }
        fila.splice(0, lote.length); salvarFila();
      }
      setStatus('online');
    } finally { enviando = false; }
  }
  const traduzir = (m = '') => (/row-level security/i.test(m) ? (perfil?.empresa?.liberada === false ? 'assinatura vencida: os dados estão só para consulta' : 'sem permissão para esta alteração') : m || 'operação recusada pelo servidor');
  window.addEventListener('online', () => enviar());
  sb.auth.onAuthStateChange((evento) => { if (evento === 'PASSWORD_RECOVERY') setTimeout(() => hooks.onRecuperacao?.(), 300); });

  function ouvir() {
    canal?.unsubscribe();
    canal = sb.channel(`${SEGMENTO.id}-${app}`);
    canal.on('postgres_changes', { event: '*', schema: SCHEMA, table: 'docs', filter: `empresa_id=eq.${empresa()}` }, (p) => {
      if (!state) return;
      const id = p.new?.id || p.old?.id;
      if (fila.some((op) => op.id === id)) return; // alteração local ainda pendente
      if (p.eventType === 'DELETE') {
        for (const c of COLECOES) { const i = state[c].findIndex((x) => x.id === id); if (i >= 0) { state[c].splice(i, 1); snap[c].delete(id); hooks.onChange?.(c, true); } }
        return;
      }
      const c = p.new.colecao;
      if (c === 'config') { if (id === 'geral') { state.meta = { ...p.new.data, demo: false }; snap.meta = JSON.stringify(state.meta); hooks.onChange?.('config', true); } return; }
      if (!state[c]) return;
      const j = JSON.stringify(p.new.data);
      if (snap[c].get(id) === j) return; // eco da própria gravação
      const i = state[c].findIndex((x) => x.id === id);
      const antes = i >= 0 ? state[c][i] : null;
      if (i >= 0) state[c][i] = p.new.data; else state[c].push(p.new.data);
      snap[c].set(id, j);
      hooks.onChange?.(c, true, { colecao: c, doc: p.new.data, antes, novo: !antes });
    });
    canal.subscribe();
  }

  async function lerPerfil() {
    const { data, error } = await sb.rpc('meu_perfil');
    if (error) throw error;
    perfil = data || null;
    return perfil;
  }

  async function iniciarSessao() {
    await lerPerfil();
    if (!perfil?.empresaId) return false;
    await carregar();
    ouvir();
    enviar();
    sb.rpc('registrar_acesso').then(({ error }) => error && console.warn('registrar_acesso', error.message));
    return true;
  }

  const erroLogin = (m) => (m === 'Invalid login credentials' ? 'E-mail ou senha incorretos' : m === 'Email not confirmed' ? 'Confirme o e-mail antes de entrar (veja sua caixa de entrada)' : m);

  return {
    sb,
    get state() { return state; },
    get perfil() { return perfil; },
    get status() { return fila.length && status === 'online' ? 'enviando' : status; },
    get pendentes() { return fila.length; },
    registrarMudancas,
    get suporte() { return suporte; },
    async iniciar() {
      if (suporte?.access_token) { await sb.auth.setSession({ access_token: suporte.access_token, refresh_token: suporte.refresh_token }); delete suporte.access_token; sessionStorage.setItem(SUP_KEY, JSON.stringify(suporte)); }
      const { data } = await sb.auth.getSession();
      if (!data.session) return false;
      try { return await iniciarSessao(); } catch (e) { console.warn(e); hooks.onErro?.('Sem conexão com o servidor. Tente novamente.'); return false; }
    },
    async entrarEmail(email, senha) {
      const { error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error) throw new Error(erroLogin(error.message));
      return iniciarSessao();
    },
    async cadastrar(email, senha) {
      const { data, error } = await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw new Error(error.message);
      return !!data.session; // false = precisa confirmar o e-mail
    },
    async criarEmpresa(nome) {
      const { error } = await sb.rpc('criar_empresa', { p_nome: nome });
      if (error) throw new Error(error.message);
      return iniciarSessao();
    },
    async entrarConvite(codigo) {
      const { data, error } = await sb.rpc('entrar_convite', { p_codigo: codigo });
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Convite inválido, expirado ou já usado');
      return iniciarSessao();
    },
    async entrarCodigo(codigo, pin) {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) {
        const { error } = await sb.auth.signInAnonymously();
        if (error) throw new Error(/anonymous/i.test(error.message) ? 'Login por código desativado no servidor (ative "Anonymous sign-ins" no Supabase).' : error.message);
      }
      const { data, error } = await sb.rpc('vincular_usuario', { p_codigo: codigo, p_pin: pin });
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Código ou PIN incorreto');
      return iniciarSessao();
    },
    async redefinirSenha(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (error) throw new Error(error.message);
    },
    async novaSenha(senha) {
      const { error } = await sb.auth.updateUser({ password: senha });
      if (error) throw new Error(error.message);
    },
    async sair() {
      canal?.unsubscribe();
      if (suporte) { try { sessionStorage.removeItem(SUP_KEY); } catch {} }
      await sb.auth.signOut();
      perfil = null; state = null;
    },
    async temSessao() { return !!(await sb.auth.getSession())?.data?.session; },
    lerPerfil,
    // Acessos (código + PIN) dos usuários do app de campo
    acessos: {
      async listar() { const { data, error } = await sb.from('acessos').select('codigo,ref,nome,pin,ativo').eq('empresa_id', empresa()); if (error) throw new Error(error.message); return data; },
      async criar(ref, nome) { const { data, error } = await sb.from('acessos').insert({ empresa_id: empresa(), ref, nome }).select('codigo,ref,nome,pin,ativo').single(); if (error) throw new Error(traduzir(error.message)); return data; },
      async alterar(ref, campos) { const { error } = await sb.from('acessos').update(campos).eq('empresa_id', empresa()).eq('ref', ref); if (error) throw new Error(traduzir(error.message)); },
      async apagar(ref) { const { error } = await sb.from('acessos').delete().eq('empresa_id', empresa()).eq('ref', ref); if (error) throw new Error(error.message); },
    },
    async renomearEmpresa(nome) { const { error } = await sb.from('empresas').update({ nome }).eq('id', empresa()); if (error) throw new Error(error.message); perfil.empresa.nome = nome; },
    rpc: async (fn, args) => { const { data, error } = await sb.rpc(fn, args); if (error) throw new Error(error.message); return data; },
    recarregar: async () => { await lerPerfil(); await carregar(); hooks.onChange?.('recarregado', true); },
  };
}
