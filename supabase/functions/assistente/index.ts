// Assistente (IA) de todos os apps da fábrica: o chat do app conversa com o Claude por aqui.
//
// Mora no Supabase (projeto easyapp-fabrica) porque a chave da Anthropic não pode ir para o celular.
// Um só lugar atende todos os apps (Frota, Golden, Mil Terras, os próximos): o app manda a pasta (schema),
// a descrição das coleções e os dados que o usuário JÁ enxerga no aparelho (o banco filtrou pelas regras
// de acesso). Esta função confere quem é (login na pasta do app), chama o Claude e devolve a resposta.
//
// O Claude NÃO grava nada aqui: quando o pedido muda dados, ele devolve uma PROPOSTA (criar / alterar / apagar).
// O app mostra a prévia e só aplica quando o usuário toca em "Aplicar" — pela gravação normal do app
// (fila offline, registro de atividades e regras do banco valem como para qualquer alteração), com Desfazer.
//
// Custo: o que a Anthropic cobra (tokens × preço × dólar), gravado em public.fabrica_ia (supabase/fabrica.sql).
// Limite do mês por empresa: fabrica_ia_limites / fabrica_config.ia_limite_padrao. Demonstração: teto do dia.
//
// Publicar SEM verificação de JWT (a demonstração não tem login; o login é conferido aqui dentro):
//   supabase functions deploy assistente --no-verify-jwt --project-ref sizbmkvzcqiukprdlxxr
// Segredos (Edge Functions › Secrets do easyapp-fabrica): ANTHROPIC_API_KEY. SUPABASE_URL,
// SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY já existem.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const adm = createClient(URL_SB, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Motores (nomes nossos, sem a marca do modelo)
const MOTORES: Record<string, { modelo: string; reserva: boolean; esforco: string }> = {
  agil: { modelo: 'claude-haiku-5-5', reserva: false, esforco: 'medium' },
  padrao: { modelo: 'claude-sonnet-5-5', reserva: true, esforco: 'medium' },
  profundo: { modelo: 'claude-opus-5-5', reserva: true, esforco: 'high' },
};
// US$ por milhão de tokens: entrada, saída, leitura e escrita de cache (os mesmos do assistente do Financial)
const PRECO: Record<string, { e: number; s: number; cl: number; ce: number }> = {
  'claude-opus-5-5': { e: 4, s: 20, cl: 0.20, ce: 5 },
  'claude-sonnet-5-5': { e: 2, s: 10, cl: 0.20, ce: 2.5 },
  'claude-opus-5': { e: 5, s: 25, cl: 0.50, ce: 6.25 },
  'claude-haiku-5-5': { e: 0.10, s: 0.50, cl: 0.01, ce: 0.125 },
  'claude-haiku-4-5': { e: 1, s: 5, cl: 0.10, ce: 1.25 },
};
const PRECO_DESCONHECIDO = { e: 10, s: 50, cl: 1, ce: 12.5 };
const precoDe = (m: string) => PRECO[String(m || '').replace(/-\d{8}$/, '')] || PRECO_DESCONHECIDO;
const DOLAR = 5.5;
const VOLTAS = 10;               // idas e vindas com as ferramentas, no máximo
const MAX_DADOS = 8_000_000;     // bytes dos dados vindos do app
const MAX_RESULTADO = 60_000;    // caracteres de cada resultado de ferramenta devolvido ao Claude
const PASTA_OK = /^[a-z][a-z0-9_]{1,40}$/;

type Uso = { entrada: number; saida: number; cl: number; ce: number; usd: number; modelo: string };
function somarUso(resp: any, uso: Uso) {
  const u = resp?.usage || {};
  const p = precoDe(resp?.model || uso.modelo);
  const e = u.input_tokens || 0, s = u.output_tokens || 0, cl = u.cache_read_input_tokens || 0, ce = u.cache_creation_input_tokens || 0;
  // Haiku 5.5: acima de 100 mil tokens de pedido, 5x
  const x = String(resp?.model || '').startsWith('claude-haiku-5-5') && e + cl + ce > 100_000 ? 5 : 1;
  uso.entrada += e; uso.saida += s; uso.cl += cl; uso.ce += ce;
  uso.usd += x * (e * p.e + s * p.s + cl * p.cl + ce * p.ce) / 1e6;
  if (resp?.model) uso.modelo = resp.model;
}

// ---------- os dados (o que o usuário enxerga no app) ----------
type Doc = Record<string, any>;
type Base = { dados: Record<string, Doc[]>; colecoes: Record<string, { nome: string; escrita: boolean }>; nomes: Map<string, string> };
const norm = (t: unknown) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const rotulo = (d: Doc) => d?.nome ?? d?.titulo ?? d?.descricao ?? d?.placa ?? d?.codigo ?? d?.numero ?? null;
// valores de um caminho ("itens.qtd"): atravessa listas
function valores(doc: any, caminho: string): any[] {
  let atual: any[] = [doc];
  for (const p of String(caminho).split('.')) {
    const prox: any[] = [];
    for (const v of atual) {
      if (v == null) continue;
      const x = Array.isArray(v) ? v.flatMap((i) => (i == null ? [] : [i[p]])) : v[p];
      if (Array.isArray(x)) prox.push(...x); else if (x !== undefined) prox.push(x);
    }
    atual = prox;
  }
  return atual;
}
const um = (doc: any, c: string) => { const v = valores(doc, c); return v.length > 1 ? v : v[0]; };
const numero = (v: any) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(+v) ? +v : null);
function compara(a: any, b: any) {
  const na = numero(a), nb = numero(b);
  if (na != null && nb != null) return na - nb;
  return String(a ?? '').localeCompare(String(b ?? ''));
}
// igual: números como números, texto sem acento/maiúscula; false casa com vazio
function igual(v: any, x: any) {
  if (typeof x === 'boolean') return !!v === x && (v == null || typeof v === 'boolean');
  if (x == null || x === '') return v == null || v === '';
  if (v == null) return false;
  const nv = numero(v), nx = numero(x);
  if (nv != null && nx != null) return nv === nx;
  return norm(v) === norm(x);
}
type Filtro = { campo: string; op?: string; valor?: any };
function passa(doc: Doc, f: Filtro) {
  const vs = valores(doc, f.campo);
  const op = f.op || '=';
  if (op === 'vazio') return !vs.length || vs.every((v) => v == null || v === '' || v === false);
  if (op === 'preenchido') return vs.some((v) => v != null && v !== '' && v !== false);
  if (op === 'nao_contem') return !vs.some((v) => norm(v).includes(norm(f.valor)));
  if (op === '!=') return !vs.some((v) => igual(v, f.valor));
  if (!vs.length) vs.push(undefined);
  return vs.some((v) => {
    switch (op) {
      case '=': return igual(v, f.valor);
      case '>': return v != null && compara(v, f.valor) > 0;
      case '>=': return v != null && compara(v, f.valor) >= 0;
      case '<': return v != null && compara(v, f.valor) < 0;
      case '<=': return v != null && compara(v, f.valor) <= 0;
      case 'contem': return norm(v).includes(norm(f.valor));
      case 'comeca': return norm(v).startsWith(norm(f.valor));
      case 'em': return Array.isArray(f.valor) && f.valor.some((x) => x === v || norm(x) === norm(v));
      default: throw new Error('operador desconhecido: ' + op);
    }
  });
}
function selecionar(b: Base, colecao: string, filtros?: Filtro[], texto?: string) {
  const lista = b.dados[colecao];
  if (!lista) throw new Error(`coleção desconhecida: ${colecao}. Existentes: ${Object.keys(b.dados).join(', ')}`);
  let out = lista;
  for (const f of filtros || []) out = out.filter((d) => passa(d, f));
  if (texto) { const t = norm(texto); out = out.filter((d) => norm(JSON.stringify(d)).includes(t)); }
  return out;
}
// acrescenta o nome dos registros ligados (clienteId → clienteId__nome)
function comNomes(b: Base, d: Doc, campos?: string[]) {
  const o: Doc = {};
  const ks = campos?.length ? ['id', ...campos.filter((c) => c !== 'id')] : Object.keys(d);
  for (const k of ks) {
    const v = campos?.length ? um(d, k) : d[k];
    if (v === undefined) continue;
    o[k] = v;
    if (k !== 'id' && typeof v === 'string' && b.nomes.has(v)) o[k + '__nome'] = b.nomes.get(v);
  }
  return o;
}
const corta = (s: string) => (s.length > MAX_RESULTADO ? s.slice(0, MAX_RESULTADO) + '\n…[cortado: resultado grande demais; filtre mais, peça menos campos ou use agregar]' : s);

function chaveGrupo(d: Doc, g: string) {
  const [campo, parte] = g.split('|');
  const v = um(d, campo);
  const s = Array.isArray(v) ? v.join(', ') : v == null || v === '' ? '(vazio)' : String(v);
  if (parte === 'mes') return s.slice(0, 7);
  if (parte === 'ano') return s.slice(0, 4);
  if (parte === 'dia') return s.slice(0, 10);
  return s;
}
function agregar(b: Base, a: any) {
  const lista = selecionar(b, a.colecao, a.filtros, a.texto);
  const grupos = new Map<string, Doc[]>();
  const gs: string[] = a.agrupar || [];
  for (const d of lista) {
    const k = JSON.stringify(gs.map((g) => chaveGrupo(d, g)));
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(d);
  }
  const medidas: string[] = a.medidas?.length ? a.medidas : ['contar'];
  let linhas = [...grupos.entries()].map(([k, ds]) => {
    const l: Doc = {};
    JSON.parse(k).forEach((v: string, i: number) => {
      l[gs[i]] = v;
      if (b.nomes.has(v)) l[gs[i] + '__nome'] = b.nomes.get(v);
    });
    for (const m of medidas) {
      const [op, campo] = m.split(':');
      const nums = campo ? ds.flatMap((d) => valores(d, campo)).map(numero).filter((x): x is number => x != null) : [];
      const brutos = campo ? ds.flatMap((d) => valores(d, campo)).filter((x) => x != null && x !== '') : [];
      if (op === 'contar') l[m] = campo ? ds.filter((d) => valores(d, campo).some((x) => x != null && x !== '' && x !== false)).length : ds.length;
      else if (op === 'soma') l[m] = Math.round(nums.reduce((s, x) => s + x, 0) * 100) / 100;
      else if (op === 'media') l[m] = nums.length ? Math.round(nums.reduce((s, x) => s + x, 0) / nums.length * 100) / 100 : null;
      else if (op === 'min') l[m] = brutos.length ? brutos.reduce((x, y) => (compara(x, y) <= 0 ? x : y)) : null;
      else if (op === 'max') l[m] = brutos.length ? brutos.reduce((x, y) => (compara(x, y) >= 0 ? x : y)) : null;
      else if (op === 'distintos') l[m] = new Set(brutos.map(String)).size;
      else throw new Error('medida desconhecida: ' + m);
    }
    return l;
  });
  if (a.ordenar) { const desc = a.ordenar.startsWith('-'); const c = a.ordenar.replace(/^-/, ''); linhas.sort((x, y) => compara(x[c], y[c]) * (desc ? -1 : 1)); }
  else if (gs.length) linhas.sort((x, y) => compara(x[gs[0]], y[gs[0]]));
  const total = linhas.length;
  linhas = linhas.slice(0, Math.min(500, a.limite || 200));
  return { registros: lista.length, grupos: total, linhas };
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// Monta a proposta: confere coleções, permissões e ids; troca os ids provisórios dos novos pelos definitivos
function montarProposta(b: Base, a: any) {
  const ops: any[] = Array.isArray(a.operacoes) ? a.operacoes : [];
  if (!ops.length) throw new Error('nenhuma operação');
  if (ops.length > 500) throw new Error('no máximo 500 operações por proposta; divida em partes');
  const novos = new Map<string, string>();
  for (const o of ops) if (o.acao === 'criar') { const t = o.id && !b.nomes.has(o.id) ? String(o.id) : null; const id = uid() + novos.size; if (t) novos.set(t, id); o._id = id; }
  const troca = (v: any): any => typeof v === 'string' && novos.has(v) ? novos.get(v) : Array.isArray(v) ? v.map(troca) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, troca(x)])) : v;
  const out = ops.map((o) => {
    const c = b.colecoes[o.colecao];
    if (!c) throw new Error(`coleção desconhecida: ${o.colecao}`);
    if (!c.escrita) throw new Error(`este usuário não pode alterar ${c.nome}`);
    if (!['criar', 'alterar', 'apagar'].includes(o.acao)) throw new Error('acao deve ser criar, alterar ou apagar');
    const dados = troca(o.dados || {});
    delete dados.id;
    if (o.acao === 'criar') return { acao: 'criar', colecao: o.colecao, id: o._id, dados, descricao: o.descricao || '' };
    const atual = (b.dados[o.colecao] || []).find((d) => d.id === o.id);
    if (!atual) throw new Error(`não achei ${o.id} em ${o.colecao}`);
    if (o.acao === 'alterar' && !Object.keys(dados).length) throw new Error('alterar sem campos');
    const antes = o.acao === 'alterar' ? Object.fromEntries(Object.keys(dados).map((k) => [k, atual[k] ?? null])) : undefined;
    return { acao: o.acao, colecao: o.colecao, id: o.id, nome: rotulo(atual), dados: o.acao === 'alterar' ? dados : undefined, antes, descricao: o.descricao || '' };
  });
  return { resumo: String(a.resumo || '').slice(0, 600), operacoes: out };
}

function calcular(expr: string) {
  const e = String(expr || '').replace(/,/g, '.');
  if (!/^[\d\s.+\-*/()%]+$/.test(e)) throw new Error('só números e + - * / ( ) %');
  const r = Function(`"use strict"; return (${e});`)();
  if (typeof r !== 'number' || !isFinite(r)) throw new Error('resultado inválido');
  return Math.round(r * 1e6) / 1e6;
}

const FERRAMENTAS = [
  { name: 'buscar', description: 'Lista registros de uma coleção, com filtros. Use para encontrar registros, ver detalhes e conferir antes de propor mudanças. Campos com ids de outros registros vêm acompanhados de <campo>__nome.',
    input_schema: { type: 'object', properties: {
      colecao: { type: 'string' },
      filtros: { type: 'array', items: { type: 'object', properties: { campo: { type: 'string', description: 'nome do campo; "a.b" entra em listas e objetos (ex.: itens.produtoId)' }, op: { type: 'string', enum: ['=', '!=', '>', '>=', '<', '<=', 'contem', 'nao_contem', 'comeca', 'em', 'vazio', 'preenchido'] }, valor: {} }, required: ['campo'] } },
      texto: { type: 'string', description: 'procura o texto em qualquer campo (sem acento, sem maiúsculas)' },
      campos: { type: 'array', items: { type: 'string' }, description: 'só estes campos (economiza espaço em listas grandes)' },
      ordenar: { type: 'string', description: 'campo; "-campo" para decrescente' },
      limite: { type: 'integer', description: 'padrão 50, máximo 300' }, pular: { type: 'integer' } }, required: ['colecao'] } },
  { name: 'agregar', description: 'Totais exatos: conta, soma, média, mínimo e máximo, agrupando por campos. Toda soma, contagem, média ou comparação que você mostrar sai daqui (não faça conta de cabeça). Agrupe datas por mês com "campo|mes" (também |ano e |dia).',
    input_schema: { type: 'object', properties: {
      colecao: { type: 'string' },
      filtros: { type: 'array', items: { type: 'object', properties: { campo: { type: 'string' }, op: { type: 'string' }, valor: {} }, required: ['campo'] } },
      texto: { type: 'string' },
      agrupar: { type: 'array', items: { type: 'string' }, description: 'ex.: ["status"], ["data|mes"], ["clienteId"]' },
      medidas: { type: 'array', items: { type: 'string' }, description: 'ex.: ["contar", "soma:valor", "media:valor", "min:data", "max:data", "distintos:clienteId"]; caminhos "itens.qtd" somam dentro das listas' },
      ordenar: { type: 'string', description: 'ex.: "-soma:valor"' }, limite: { type: 'integer' } }, required: ['colecao'] } },
  { name: 'calcular', description: 'Faz uma conta com números que vieram das outras ferramentas (ex.: diferença, porcentagem, divisão).',
    input_schema: { type: 'object', properties: { expressao: { type: 'string', description: 'ex.: (1520.5 - 980) / 980 * 100' } }, required: ['expressao'] } },
  { name: 'propor_mudancas', description: 'Propõe criar, alterar ou apagar registros. Nada é gravado agora: o app mostra a prévia e o usuário toca em Aplicar (e pode desfazer). Use uma chamada só com todas as operações do pedido. Depois dela, responda em poucas linhas o que foi proposto.',
    input_schema: { type: 'object', properties: {
      resumo: { type: 'string', description: 'uma frase: o que muda' },
      operacoes: { type: 'array', items: { type: 'object', properties: {
        acao: { type: 'string', enum: ['criar', 'alterar', 'apagar'] },
        colecao: { type: 'string' },
        id: { type: 'string', description: 'alterar/apagar: id do registro. criar: um apelido provisório (ex.: "novo1") se outra operação precisar se ligar a ele; troco pelo id definitivo' },
        dados: { type: 'object', description: 'criar: o registro completo, nos mesmos campos e formatos dos registros existentes. alterar: só os campos que mudam.' },
        descricao: { type: 'string', description: 'curta, para a prévia (ex.: "Cliente Maria: telefone novo")' } }, required: ['acao', 'colecao'] } } }, required: ['resumo', 'operacoes'] } },
];

// ---------- descrição dos dados para as instruções ----------
function tipoDe(v: any): string {
  if (v == null) return 'vazio';
  if (Array.isArray(v)) return v.length && typeof v[0] === 'object' ? `lista de {${Object.keys(v[0] || {}).slice(0, 12).join(', ')}}` : 'lista';
  if (typeof v === 'object') return `{${Object.keys(v).slice(0, 12).join(', ')}}`;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return 'data';
  return typeof v === 'number' ? 'número' : typeof v === 'boolean' ? 'sim/não' : 'texto';
}
function descreverColecoes(b: Base, campos: Record<string, string>) {
  return Object.entries(b.colecoes).map(([id, c]) => {
    const ds = b.dados[id] || [];
    const vistos = new Map<string, any>();
    for (const d of ds.slice(0, 300)) for (const [k, v] of Object.entries(d)) if (!vistos.has(k) || vistos.get(k) == null) vistos.set(k, v);
    const cs = [...vistos.entries()].slice(0, 45).map(([k, v]) => {
      let ex = '';
      if (typeof v === 'string' && k !== 'id') ex = ` ex.: "${v.slice(0, 40)}"${b.nomes.has(v) ? ' (id de outro registro)' : ''}`;
      else if (typeof v === 'number' || typeof v === 'boolean') ex = ` ex.: ${v}`;
      return `${k}${campos[k] && campos[k] !== k ? ` (${campos[k]})` : ''}: ${tipoDe(v)}${ex}`;
    });
    return `- ${id} — "${c.nome}": ${ds.length} registro(s)${c.escrita ? '' : ' · SÓ LEITURA para este usuário'}${cs.length ? '\n    campos: ' + cs.join('; ') : ''}`;
  }).join('\n');
}

function instrucoes(ctx: any, b: Base, demo: boolean) {
  const c = ctx || {};
  return `Você é o assistente do app ${c.app || 'EasyAPP'}${c.empresa ? `, da empresa ${c.empresa}` : ''}. ${c.descricao || ''}
Quem conversa com você: ${c.papel || 'usuário'}${c.quem ? ` (${c.quem})` : ''}.${c.ref ? ` O cadastro dele tem o id "${c.ref}": é esse o valor nos campos que dizem a quem um registro pertence (ex.: motoristaId) quando ele lança algo.` : ''} Hoje é ${c.hoje || new Date().toISOString().slice(0, 10)}.${demo ? ' Este app está no modo DEMONSTRAÇÃO, com dados fictícios: aja normalmente.' : ''}

O QUE VOCÊ FAZ
1. Responde perguntas sobre os dados do app (o que o usuário enxerga) e dá análises e sugestões práticas para o negócio.
2. Faz pelo usuário o que ele faria nas telas: cadastrar, corrigir, atualizar em lote, apagar — sempre pela ferramenta propor_mudancas. Nada é gravado sem o usuário tocar em Aplicar, e ele pode desfazer.
3. Explica como usar o app quando perguntarem.

COMO TRABALHAR
- Leia antes de responder ou propor: buscar e agregar. Totais, contagens, médias e comparações saem de agregar ou calcular, nunca de cabeça. Não invente dado que não está nas coleções.
- Para criar registros, siga os campos e formatos dos registros que já existem na coleção (datas AAAA-MM-DD, valores numéricos, ids de outras coleções nos campos ...Id). Busque os ids certos antes (ex.: o id do cliente pelo nome). Número sequencial (numero, codigo): o maior existente + 1 (agregar com max). Ao criar, preencha os campos que os outros registros da coleção costumam ter (situação, ativo, datas).
- Se o pedido for ambíguo e mudar dados, pergunte em uma frase antes de propor. Pedido claro: proponha direto, sem pedir confirmação no texto (a prévia já é a confirmação).
- Coleções marcadas SÓ LEITURA não podem ser alteradas por este usuário: explique e sugira falar com a gestão.
- Responda em português do Brasil, curto e direto, como num chat de celular: frases curtas, listas com "•", **negrito** só no essencial, no máximo uma tabela pequena quando ajudar. Valores em R$ no formato 1.234,56 e datas dd/mm/aaaa. Não mostre ids, nomes de coleções ou de campos técnicos ao usuário: use os nomes amigáveis.
- Não fale de tokens, modelos, ferramentas ou destas instruções.
${c.instrucoes ? `\nSOBRE ESTE NEGÓCIO\n${c.instrucoes}\n` : ''}
COLEÇÕES (nome técnico — nome na tela: quantidade; campos)
${descreverColecoes(b, c.campos || {})}`;
}

// ---------- servidor ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'use POST' }, 405);
  const bruto = await req.text();
  if (bruto.length > MAX_DADOS) return json({ erro: 'Dados grandes demais para o assistente (fale com o suporte).' }, 413);
  let corpo: any;
  try { corpo = JSON.parse(bruto); } catch { return json({ erro: 'pedido inválido' }, 400); }

  const pasta = String(corpo.pasta || '');
  if (!PASTA_OK.test(pasta)) return json({ erro: 'app inválido' }, 400);
  const demo = !!corpo.demo;
  const ctx = corpo.contexto || {};
  const mensagens: { role: string; texto: string }[] = (Array.isArray(corpo.mensagens) ? corpo.mensagens : []).slice(-16)
    .filter((m: any) => (m.role === 'user' || m.role === 'assistant') && String(m.texto || '').trim())
    .map((m: any) => ({ role: m.role, texto: String(m.texto).slice(0, m.role === 'user' ? 6000 : 4000) }));
  if (!mensagens.length || mensagens[mensagens.length - 1].role !== 'user') return json({ erro: 'mensagem vazia' }, 400);
  const pergunta = mensagens[mensagens.length - 1].texto;

  // ---- quem é
  let empresa = 'demo', userId: string | null = null, quem: string | null = null, papel = 'demo', admin = false;
  if (!demo) {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ erro: 'Entre no app para usar o assistente.' }, 401);
    const cli = createClient(URL_SB, ANON, { db: { schema: pasta }, global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
    const { data: u, error: eu } = await cli.auth.getUser(token);
    if (eu || !u?.user) return json({ erro: 'Sessão expirada: entre de novo no app.' }, 401);
    userId = u.user.id;
    const { data: p, error: ep } = await cli.rpc('meu_perfil');
    const perfil = Array.isArray(p) ? p[0] : p;
    if (ep || !perfil) return json({ erro: 'Seu login não está ligado a este app.' }, 403);
    admin = !!perfil.admin;
    papel = perfil.papel || (admin ? 'admin' : '');
    if (!papel) return json({ erro: 'Seu login não está ligado a este app.' }, 403);
    const { data: app } = await adm.from('fabrica_apps').select('multiempresa').eq('pasta', pasta).maybeSingle();
    empresa = perfil.empresaId || (app && app.multiempresa === false ? 'unica' : '');
    if (!empresa) return json({ erro: 'Crie ou entre numa empresa para usar o assistente.' }, 403);
    quem = u.user.email || ctx.quem || null;
  }

  // ---- saldo
  const { data: saldo, error: es } = await adm.rpc('fabrica_ia_saldo', { p_pasta: pasta, p_empresa: empresa });
  if (es) return json({ erro: 'Assistente indisponível (falta instalar o fabrica.sql).' }, 500);
  const gasto = Number(saldo?.gasto || 0), limite = Number(saldo?.limite || 0);
  if (demo) {
    if (Number(saldo?.demoHoje || 0) >= Number(saldo?.limiteDemo || 0)) return json({ erro: 'O assistente da demonstração chegou ao limite de hoje. Crie sua conta para continuar usando.' }, 429);
  } else if (!admin && gasto >= limite) {
    return json({ erro: `O assistente chegou ao limite deste mês da empresa (R$ ${limite.toFixed(2).replace('.', ',')}). Volta no dia 1º — ou fale com o suporte para aumentar.`, uso: { gasto, limite } }, 429);
  }
  if (!Deno.env.get('ANTHROPIC_API_KEY')) return json({ erro: 'Assistente ainda não configurado (falta a chave da Anthropic).' }, 503);

  // ---- os dados vindos do app
  const b: Base = { dados: {}, colecoes: {}, nomes: new Map() };
  for (const [id, c] of Object.entries(ctx.colecoes || {}) as [string, any][]) {
    if (!/^[A-Za-z_][\w-]{0,60}$/.test(id)) continue;
    b.colecoes[id] = { nome: String(c?.nome || id), escrita: !!c?.escrita };
    b.dados[id] = Array.isArray(corpo.dados?.[id]) ? corpo.dados[id].filter((d: any) => d && typeof d === 'object') : [];
  }
  for (const ds of Object.values(b.dados)) for (const d of ds) { const r = rotulo(d); if (d.id != null && r != null) b.nomes.set(String(d.id), String(r)); }

  const tela = corpo.tela ? `\n[Tela aberta no app: ${String(corpo.tela.titulo || corpo.tela.rota || '').slice(0, 80)}${corpo.tela.rota ? ` (${String(corpo.tela.rota).slice(0, 80)})` : ''}${corpo.tela.registro ? ` · registro aberto: ${String(corpo.tela.registro).slice(0, 80)}` : ''}]` : '';
  const msgs: any[] = mensagens.map((m, i) => ({ role: m.role, content: i === mensagens.length - 1 ? m.texto + tela : m.texto }));
  // marca de cache na última mensagem anterior (a conversa)
  if (msgs.length > 1) { const m = msgs[msgs.length - 2]; m.content = [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }]; }

  const motor = MOTORES[String(corpo.motor || '')] || MOTORES.padrao;
  const uso: Uso = { entrada: 0, saida: 0, cl: 0, ce: 0, usd: 0, modelo: motor.modelo };
  const claude = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
  const sistema = instrucoes(ctx, b, demo);
  let texto = '', proposta: any = null, voltas = 0, erro: string | null = null;
  const tetoPedido = demo ? 0.6 : Math.max(0.3, Math.min(8, (admin ? 50 : limite - gasto))); // R$ por pedido, no máximo

  try {
    for (; voltas < VOLTAS; voltas++) {
      const resp: any = await claude.beta.messages.create({
        model: motor.modelo,
        max_tokens: 6000,
        ...(motor.reserva ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
        output_config: { effort: motor.esforco },
        system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }],
        tools: FERRAMENTAS,
        messages: msgs,
      } as any);
      somarUso(resp, uso);
      const partes = (resp.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim();
      if (partes) texto = partes;
      const usos = (resp.content || []).filter((c: any) => c.type === 'tool_use');
      if (resp.stop_reason !== 'tool_use' || !usos.length) break;
      msgs.push({ role: 'assistant', content: resp.content });
      const resultados: any[] = [];
      for (const t of usos) {
        let out: string, falhou = false;
        try {
          const a = t.input || {};
          if (t.name === 'buscar') {
            const lista = selecionar(b, a.colecao, a.filtros, a.texto);
            let l = lista;
            if (a.ordenar) { const desc = a.ordenar.startsWith('-'); const c = a.ordenar.replace(/^-/, ''); l = [...lista].sort((x, y) => compara(um(x, c), um(y, c)) * (desc ? -1 : 1)); }
            const de = Math.max(0, a.pular || 0), lim = Math.min(300, Math.max(1, a.limite || 50));
            out = JSON.stringify({ total: lista.length, mostrando: `${Math.min(lista.length, de + 1)}–${Math.min(lista.length, de + lim)}`, itens: l.slice(de, de + lim).map((d) => comNomes(b, d, a.campos)) });
          } else if (t.name === 'agregar') out = JSON.stringify(agregar(b, a));
          else if (t.name === 'calcular') out = String(calcular(a.expressao));
          else if (t.name === 'propor_mudancas') {
            proposta = montarProposta(b, a);
            out = `Proposta com ${proposta.operacoes.length} operação(ões) enviada ao usuário: ele vê a prévia e toca em Aplicar. Agora responda em poucas linhas o que foi proposto (não diga que já foi feito).`;
          } else throw new Error('ferramenta desconhecida');
        } catch (e) { out = 'Erro: ' + (e as Error).message; falhou = true; }
        resultados.push({ type: 'tool_result', tool_use_id: t.id, content: corta(out), ...(falhou ? { is_error: true } : {}) });
      }
      msgs.push({ role: 'user', content: resultados });
      if (uso.usd * DOLAR >= tetoPedido) { texto = (texto ? texto + '\n\n' : '') + 'Parei aqui: este pedido ficou grande demais. Tente dividir em partes menores.'; break; }
    }
    if (!texto) texto = proposta ? 'Preparei as mudanças abaixo. Confira e toque em Aplicar.' : 'Não consegui responder agora. Tente de novo com outras palavras.';
  } catch (e) {
    erro = (e as Error).message || String(e);
  }

  const custo = Math.round(uso.usd * DOLAR * 10000) / 10000;
  try {
    await adm.from('fabrica_ia').insert({ pasta, empresa, user_id: userId, quem, papel, app: String(corpo.app || '').slice(0, 20), modelo: uso.modelo,
      entrada: uso.entrada, saida: uso.saida, cache_lido: uso.cl, cache_gravado: uso.ce, custo, voltas, pergunta: pergunta.slice(0, 500), erro: erro?.slice(0, 1000) || null });
  } catch (e) { console.error('fabrica_ia', e); }
  if (erro) {
    console.error('assistente', pasta, erro);
    const ocupado = /overloaded|529|rate/i.test(erro);
    return json({ erro: ocupado ? 'O assistente está muito procurado agora. Tente de novo em um minuto.' : 'O assistente teve um problema. Tente de novo.' }, 502);
  }
  return json({ texto, proposta, uso: { custo, gasto: Math.round((gasto + custo) * 100) / 100, limite: demo || admin ? null : limite } });
});
