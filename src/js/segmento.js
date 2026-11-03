// =====================================================================
// SEGMENTO — tudo o que define este app. É o primeiro arquivo a mudar num segmento novo.
// (Este é o exemplo do molde: ordens de serviço para equipes de campo.)
// Este arquivo é lido pelo navegador E pelo supabase/gerar.mjs: só dados, sem importar nada.
// =====================================================================
export const SEGMENTO = {
  id: 'easyapp-servicos',                 // prefixo dos dados guardados no aparelho (único por segmento)
  nome: 'EasyApp Serviços',
  slogan: 'Ordens de serviço da equipe de campo, do escritório até o cliente.',
  icone: 'wrench',                        // ícone (src/js/core/ui.js) usado quando não há logo
  logo: null,                             // ex.: 'assets/logo.png' (fundo escuro). Sem logo, usa o nome.

  // Quem cobra e dá suporte (aparece em Configurações › Assinatura)
  suporte: { nome: 'EasyApp', whatsapp: '', email: '' },
  plataforma: { admins: [] },            // e-mails que administram as empresas (assinaturas); ex.: ['voce@gmail.com']
  planos: [
    { id: 'essencial', nome: 'Essencial', preco: 99, descricao: 'até 5 técnicos' },
    { id: 'profissional', nome: 'Profissional', preco: 199, descricao: 'até 20 técnicos' },
  ],
  diasTeste: 30,

  gestao: { nome: 'EasyApp Serviços Gestão', curto: 'Gestão', descricao: 'Para o escritório: clientes, ordens de serviço, equipe e resultados.' },
  usuario: {
    nome: 'EasyApp Serviços Técnico', curto: 'Técnico', descricao: 'Para o técnico: as ordens do dia, check-in no cliente e conclusão com observações.',
    colecao: 'tecnicos',                  // cada documento desta coleção pode receber código + PIN
    papel: 'Técnico', papelPlural: 'Técnicos',
  },

  // Coleções: cada uma vira state.<nome> nos apps. Regras de acesso (aplicadas pelo banco):
  //   leitura: 'gestao' | 'todos' | 'proprio'    escrita: 'gestao' | 'proprio'
  //   ref: campo que diz a qual usuário o documento pertence ('id' = o próprio documento)
  //   protegidos: campos que o usuário não altera     trava: campo que, true, bloqueia o usuário
  colecoes: {
    clientes: { nome: 'Clientes', leitura: 'todos' },
    tecnicos: { nome: 'Técnicos', leitura: 'proprio', ref: 'id' },
    ordens: { nome: 'Ordens de serviço', leitura: 'proprio', escrita: 'proprio', ref: 'tecnicoId', protegidos: ['valor', 'clienteId', 'tecnicoId', 'descricao', 'data'], trava: 'conferida' },
  },

  // Nomes amigáveis dos campos (registro de atividades)
  campos: { nome: 'nome', telefone: 'telefone', endereco: 'endereço', status: 'situação', valor: 'valor', obs: 'observações', conferida: 'conferida', tecnicoId: 'técnico', clienteId: 'cliente', data: 'data', descricao: 'descrição' },
};
