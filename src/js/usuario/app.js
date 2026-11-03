// App do Usuário (aqui: o técnico) — exemplo do molde. Num segmento novo, reescreva este arquivo.
import { criarApp } from '../core/app.js';
import * as D from '../dominio.js';
import { money, date, dateShort, today, esc, sortBy } from '../core/fmt.js';
import { icon, badge, empty, modal, closeModal, toast } from '../core/ui.js';

const eu = () => A.S().tecnicos.find((t) => t.id === A.store.meuRef());
const agora = () => new Date().toISOString().slice(0, 16);

const A = criarApp({
  tipo: 'usuario',
  inicio: '#/inicio',
  nav: [['#/inicio', 'home', 'Hoje'], ['#/historico', 'clock', 'Histórico']],
  tabs: [['#/inicio', 'home', 'Hoje'], ['#/historico', 'clock', 'Histórico'], ['#/conta', 'user', 'Conta']],
  rotas: [['/inicio', vInicio], ['/historico', vHistorico]],
  nomeUsuario: () => eu()?.nome || '',
  dicaDemo: 'Demonstração: código CARLOS, PIN 1234',
  acoes: {
    iniciar: (el) => A.store.commit((s) => Object.assign(s.ordens.find((o) => o.id === el.dataset.id), { status: 'em_andamento', inicio: agora() })),
    concluir: (el) => modal({ title: 'Concluir OS', body: '<form id="fcc" class="col"><label class="field"><span>O que foi feito</span><textarea class="input" name="obs" required></textarea></label></form>',
      foot: '<button class="btn ghost" data-act="close">Cancelar</button><button class="btn ok" data-act="ok">Concluir</button>',
      handlers: { ok: () => { const obs = document.querySelector('#fcc [name=obs]').value.trim(); if (!obs) return toast('Conte o que foi feito'); A.store.commit((s) => Object.assign(s.ordens.find((o) => o.id === el.dataset.id), { status: 'concluida', fim: agora(), obs })); closeModal(); toast('OS concluída. Bom trabalho!'); } } }),
  },
});

function cartao(s, o) {
  const c = D.cliente(s, o.clienteId), st = D.STATUS[o.status];
  return `<div class="card col"><div class="row between"><b>#${o.numero} · ${esc(o.descricao)}</b>${badge(st.label, st.tom)}</div>
    <div class="small ink2">${icon('store')} ${esc(c?.nome || '—')}<br>${esc(c?.endereco || '')}</div><div class="tiny muted">${date(o.data)}${o.inicio ? ' · início ' + o.inicio.slice(11) : ''}</div>
    ${o.conferida ? '' : o.status === 'aberta' ? `<button class="btn block" data-act="iniciar" data-id="${o.id}">${icon('play')} Cheguei no cliente</button>` : o.status === 'em_andamento' ? `<button class="btn ok block" data-act="concluir" data-id="${o.id}">${icon('check')} Concluir</button>` : ''}</div>`;
}
function vInicio() {
  const s = A.S();
  const minhas = s.ordens.filter((o) => o.tecnicoId === A.store.meuRef());
  const abertas = sortBy(minhas.filter((o) => o.status !== 'concluida'), (o) => o.data);
  return A.tela('Hoje', `${A.pageHead(`Olá, ${esc((eu()?.nome || '').split(' ')[0])}`, `${abertas.length} OS em aberto`)}<div class="col">${abertas.map((o) => cartao(s, o)).join('') || empty('Nenhuma OS em aberto. 🎉')}</div>`);
}
function vHistorico() {
  const s = A.S();
  const feitas = sortBy(s.ordens.filter((o) => o.tecnicoId === A.store.meuRef() && o.status === 'concluida'), (o) => o.data, true);
  return A.tela('Histórico', `${A.pageHead('Histórico')}<div class="card pad-0"><div class="list" style="padding:0 16px">${feitas.map((o) => `<div class="li"><div class="grow"><div class="t">#${o.numero} · ${esc(o.descricao)}</div><div class="s">${dateShort(o.data)} · ${esc(D.cliente(s, o.clienteId)?.nome || '')}</div></div>${o.conferida ? badge('Conferida', 'ok') : badge('Aguardando conferência')}</div>`).join('') || empty('Nada concluído ainda.')}</div></div>`);
}

A.iniciar();
