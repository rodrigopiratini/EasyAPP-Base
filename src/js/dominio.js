// Regras do negócio do segmento (sem interface): cálculos usados pelos dois apps.
import { today, monthKey, sum } from './core/fmt.js';

export const STATUS = {
  aberta: { label: 'Aberta', tom: 'info' },
  em_andamento: { label: 'Em andamento', tom: 'warn' },
  concluida: { label: 'Concluída', tom: 'ok' },
};
export const cliente = (s, id) => s.clientes.find((x) => x.id === id);
export const tecnico = (s, id) => s.tecnicos.find((x) => x.id === id);
export const proximoNumero = (s) => Math.max(0, ...s.ordens.map((o) => o.numero || 0)) + 1;

export function resumoMes(s, mes = monthKey(today())) {
  const doMes = s.ordens.filter((o) => monthKey(o.data) === mes);
  const concl = doMes.filter((o) => o.status === 'concluida');
  return { total: doMes.length, concluidas: concl.length, faturamento: sum(concl, (o) => o.valor), abertas: s.ordens.filter((o) => o.status !== 'concluida').length,
    aConferir: s.ordens.filter((o) => o.status === 'concluida' && !o.conferida).length,
    porTecnico: s.tecnicos.map((t) => ({ t, qtd: concl.filter((o) => o.tecnicoId === t.id).length, valor: sum(concl.filter((o) => o.tecnicoId === t.id), (o) => o.valor) })).filter((x) => x.qtd) };
}
