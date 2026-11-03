// App de Gestão — exemplo do molde (ordens de serviço). Num segmento novo, reescreva este arquivo:
// declare nav/rotas/ações e escreva as telas; o resto vem de src/js/core/app.js.
import { criarApp } from '../core/app.js';
import { editar } from '../core/form.js';
import * as D from '../dominio.js';
import { money, money0, int, date, dateShort, today, esc, sortBy, uid } from '../core/fmt.js';
import { icon, kpi, badge, empty, iniciais, toast, confirmar } from '../core/ui.js';
import { hbars } from '../core/charts.js';

const CAMPOS_CLIENTE = [
  { k: 'nome', label: 'Nome', obrig: true, col: 2 },
  { k: 'telefone', label: 'WhatsApp', tipo: 'tel' },
  { k: 'endereco', label: 'Endereço' },
];
const CAMPOS_TECNICO = [
  { k: 'nome', label: 'Nome', obrig: true, col: 2 },
  { k: 'telefone', label: 'WhatsApp', tipo: 'tel' },
  { k: 'ativo', label: 'Ativo', tipo: 'checkbox', padrao: true },
];
const CAMPOS_OS = [
  { k: 'data', label: 'Data', tipo: 'date', obrig: true, padrao: today },
  { k: 'tecnicoId', label: 'Técnico', tipo: 'select', obrig: true, opcoes: (s) => s.tecnicos.filter((t) => t.ativo !== false).map((t) => [t.id, t.nome]) },
  { k: 'clienteId', label: 'Cliente', tipo: 'select', obrig: true, opcoes: (s) => s.clientes.map((c) => [c.id, c.nome]) },
  { k: 'valor', label: 'Valor', tipo: 'money' },
  { k: 'descricao', label: 'Serviço', obrig: true, col: 2 },
];

const A = criarApp({
  tipo: 'gestao',
  inicio: '#/painel',
  nav: [['#/painel', 'chart', 'Painel'], ['#/ordens', 'list', 'Ordens'], ['#/clientes', 'store', 'Clientes'], ['#/tecnicos', 'users', 'Técnicos']],
  badges: (s) => ({ '#/ordens': D.resumoMes(s).aConferir }),
  ativo: (h, route) => h === '#/ordens' && route.startsWith('#/ordem'),
  rotas: [['/painel', vPainel], ['/ordens', vOrdens], ['/clientes', vClientes], ['/tecnicos', vTecnicos]],
  camposEmpresa: [['whatsapp', 'WhatsApp da empresa', '5551999999999']],
  aoMudar: (msg, externo, info) => { if (externo && info?.colecao === 'ordens' && info.doc.status === 'concluida' && info.antes?.status !== 'concluida') toast(`OS ${info.doc.numero} concluída`); },
  acoes: {
    novaOS: () => editar({ titulo: 'Ordem de serviço', colecao: 'ordens', campos: CAMPOS_OS, prefixo: 'os', antesDeSalvar: (o, antes) => { if (!antes) Object.assign(o, { numero: D.proximoNumero(A.S()), status: 'aberta', conferida: false }); } }),
    editarOS: (el) => editar({ titulo: 'Ordem de serviço', colecao: 'ordens', campos: CAMPOS_OS, doc: A.S().ordens.find((o) => o.id === el.dataset.id) }),
    conferir: async (el) => { if (await confirmar('Marcar como conferida? O técnico não poderá mais alterar.', { ok: 'Conferir' })) A.store.commit((s) => { s.ordens.find((o) => o.id === el.dataset.id).conferida = true; }); },
    novoCliente: () => editar({ titulo: 'Cliente', colecao: 'clientes', campos: CAMPOS_CLIENTE, prefixo: 'cl' }),
    editarCliente: (el) => editar({ titulo: 'Cliente', colecao: 'clientes', campos: CAMPOS_CLIENTE, doc: A.S().clientes.find((x) => x.id === el.dataset.id) }),
    novoTecnico: () => editar({ titulo: 'Técnico', colecao: 'tecnicos', campos: CAMPOS_TECNICO, prefixo: 'tc' }),
    editarTecnico: (el) => editar({ titulo: 'Técnico', colecao: 'tecnicos', campos: CAMPOS_TECNICO, doc: A.S().tecnicos.find((x) => x.id === el.dataset.id) }),
  },
});

function vPainel() {
  const s = A.S();
  const r = D.resumoMes(s);
  return A.tela('Painel', `${A.pageHead('Painel', 'Este mês', `<button class="btn" data-act="novaOS">${icon('plus')} Nova OS</button>`)}
    <div class="grid g4">${kpi('Faturamento', money0(r.faturamento), `${r.concluidas} OS concluídas`)}${kpi('Em aberto', int(r.abertas), 'abertas ou em andamento')}${kpi('A conferir', int(r.aConferir), 'concluídas pelo técnico')}${kpi('OS no mês', int(r.total))}</div>
    <div class="card mt"><div class="head"><h2>Por técnico</h2></div>${r.porTecnico.length ? hbars(r.porTecnico.map((x) => ({ label: x.t.nome, value: x.valor, sub: `${x.qtd} OS` })), money0) : empty('Sem OS concluídas no mês.')}</div>`);
}

function linhaOS(s, o) {
  const c = D.cliente(s, o.clienteId), t = D.tecnico(s, o.tecnicoId), st = D.STATUS[o.status];
  return `<tr data-busca="${esc(`${o.numero} ${c?.nome} ${t?.nome} ${o.descricao}`)}"><td class="click" data-act="editarOS" data-id="${o.id}"><b>#${o.numero}</b> ${esc(o.descricao)}<div class="tiny muted">${esc(c?.nome || '—')}</div></td><td class="hide-m">${esc(t?.nome || '—')}</td><td>${dateShort(o.data)}</td>
    <td>${badge(st.label, st.tom)}${o.conferida ? ' ' + badge('Conferida', 'ok') : ''}</td><td class="r">${money(o.valor)}</td>
    <td class="r">${o.status === 'concluida' && !o.conferida ? `<button class="btn sm" data-act="conferir" data-id="${o.id}">Conferir</button>` : ''}</td></tr>`;
}
function vOrdens({ query }) {
  const s = A.S();
  const f = query.f || 'abertas';
  const lista = sortBy(s.ordens.filter((o) => f === 'todas' || (f === 'abertas' ? o.status !== 'concluida' : f === 'conferir' ? o.status === 'concluida' && !o.conferida : o.status === 'concluida')), (o) => o.data, true);
  return A.tela('Ordens', `${A.pageHead('Ordens de serviço', '', A.busca('Buscar OS, cliente…') + `<button class="btn" data-act="novaOS">${icon('plus')} Nova OS</button>`)}
    <div class="seg mb">${[['abertas', 'Em aberto'], ['conferir', 'A conferir'], ['concluidas', 'Concluídas'], ['todas', 'Todas']].map(([v, n]) => `<button class="${f === v ? 'on' : ''}" data-act="goto" data-h="#/ordens?f=${v}">${n}</button>`).join('')}</div>
    <div class="card pad-0"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>OS</th><th class="hide-m">Técnico</th><th>Data</th><th>Situação</th><th class="r">Valor</th><th></th></tr></thead>
    <tbody>${lista.map((o) => linhaOS(s, o)).join('') || `<tr><td colspan="6">${empty('Nenhuma OS aqui.')}</td></tr>`}</tbody></table></div></div>`);
}

const listaCadastro = (itens, act, sub) => `<div class="card pad-0"><div class="list" style="padding:0 16px">${itens.map((x) => `<a class="li ${x.ativo === false ? 'off' : ''}" href="#" data-act="${act}" data-id="${x.id}" data-busca="${esc(x.nome)}"><div class="avatar">${esc(iniciais(x.nome))}</div><div class="grow"><div class="t">${esc(x.nome)}</div><div class="s">${sub(x)}</div></div>${icon('arrowR', 'muted')}</a>`).join('') || empty('Nada cadastrado ainda.')}</div></div>`;
function vClientes() {
  const s = A.S();
  return A.tela('Clientes', `${A.pageHead('Clientes', '', A.busca('Buscar…') + `<button class="btn" data-act="novoCliente">${icon('plus')} Cliente</button>`)}${listaCadastro(sortBy(s.clientes, (c) => c.nome), 'editarCliente', (c) => esc(c.endereco || c.telefone || ''))}`);
}
function vTecnicos() {
  const s = A.S();
  return A.tela('Técnicos', `${A.pageHead('Técnicos', 'O acesso ao app de cada técnico (código + PIN) fica em Configurações.', `<button class="btn" data-act="novoTecnico">${icon('plus')} Técnico</button>`)}${listaCadastro(sortBy(s.tecnicos, (c) => c.nome), 'editarTecnico', (t) => `${s.ordens.filter((o) => o.tecnicoId === t.id && o.status !== 'concluida').length} OS em aberto`)}`);
}

A.iniciar();
