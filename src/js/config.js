// Conexão com o banco na nuvem (Supabase › Project Settings › API).
// A chave "publishable"/"anon" é pública por natureza: quem protege os dados são as regras
// instaladas por supabase/instalar.sql. NUNCA coloque aqui a chave "service_role"/"secret".
// Com os campos vazios, os apps funcionam só no modo demonstração (dados neste navegador).
export const CONFIG = {
  supabaseUrl: '',
  supabaseKey: '',
};
