// Edge Function "excluir-conta": apaga a conta de quem está logado (LGPD).
// Só o servidor pode apagar o login; o resto (perfil, registros, comentários...) é apagado em cascata.
// O app manda o @ digitado pela pessoa como confirmação.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, traceparent, tracestate, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function chaveSecreta(): string {
  try {
    const chaves = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    if (chaves.default) return chaves.default;
  } catch {
    /* usa a chave antiga abaixo */
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, chaveSecreta(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function resposta(dados: unknown, status = 200) {
  return new Response(JSON.stringify(dados), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta({ erro: 'metodo' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: quem, error } = await admin.auth.getUser(token);
  if (error || !quem?.user) return resposta({ erro: 'nao_logado' }, 401);
  const userId = quem.user.id;

  let corpo: { confirmacao?: string } = {};
  try {
    corpo = await req.json();
  } catch {
    /* sem corpo */
  }

  const { data: perfil } = await admin.from('profiles').select('username').eq('id', userId).maybeSingle();
  const digitado = String(corpo.confirmacao ?? '').trim().replace(/^@/, '').toLowerCase();
  if (perfil?.username && digitado !== perfil.username) return resposta({ erro: 'confirmacao' }, 400);

  const { error: erroApagar } = await admin.auth.admin.deleteUser(userId);
  if (erroApagar) {
    console.error('excluir-conta:', erroApagar.message);
    return resposta({ erro: 'falhou' }, 500);
  }
  return resposta({ ok: true });
});
