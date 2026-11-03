// Dados de demonstração do segmento (modo local / ?demo=1). seed({ vazio: true }) = começar do zero.
import { today, addDays } from './core/fmt.js';

export function seed({ vazio = false } = {}) {
  const meta = { versao: 1, demo: !vazio, empresa: 'Climatiza Serviços (demonstração)', pinGestao: '0000', whatsapp: '' };
  if (vazio) return { meta, clientes: [], tecnicos: [], ordens: [], acessos: [] };
  const t = today();
  const clientes = [
    { id: 'cl1', nome: 'Padaria Pão Quente', telefone: '51999990001', endereco: 'Rua das Flores, 120' },
    { id: 'cl2', nome: 'Clínica Bem Estar', telefone: '51999990002', endereco: 'Av. Brasil, 900 — sala 3' },
    { id: 'cl3', nome: 'Mercado Bom Preço', telefone: '51999990003', endereco: 'Rua XV, 45' },
    { id: 'cl4', nome: 'Escritório Contábil Silva', telefone: '51999990004', endereco: 'Rua Central, 300' },
  ];
  const tecnicos = [
    { id: 'tc1', nome: 'Carlos Souza', telefone: '51988880001', ativo: true },
    { id: 'tc2', nome: 'Ana Lima', telefone: '51988880002', ativo: true },
    { id: 'tc3', nome: 'Pedro Alves', telefone: '51988880003', ativo: true },
  ];
  const servicos = ['Limpeza de split 12k', 'Instalação de ar-condicionado', 'Manutenção preventiva', 'Troca de capacitor', 'Recarga de gás'];
  const ordens = [];
  let n = 1;
  for (let d = -20; d <= 2; d += 2) {
    const tc = tecnicos[n % 3], cl = clientes[n % 4];
    const data = addDays(t, d);
    const status = d < -2 ? 'concluida' : d <= 0 ? (n % 2 ? 'em_andamento' : 'aberta') : 'aberta';
    ordens.push({ id: 'os' + n, numero: n, data, clienteId: cl.id, tecnicoId: tc.id, descricao: servicos[n % servicos.length], valor: 180 + (n % 5) * 70, status,
      conferida: d < -8, inicio: status !== 'aberta' ? data + 'T09:10' : null, fim: status === 'concluida' ? data + 'T10:40' : null, obs: status === 'concluida' ? 'Serviço realizado, cliente acompanhou.' : '' });
    n++;
  }
  const acessos = [
    { codigo: 'CARLOS', ref: 'tc1', nome: 'Carlos Souza', pin: '1234', ativo: true },
    { codigo: 'ANA', ref: 'tc2', nome: 'Ana Lima', pin: '1234', ativo: true },
  ];
  return { meta, clientes, tecnicos, ordens, acessos };
}
