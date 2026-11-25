// Edge Function "responsavel": envia ao responsável o e-mail de autorização (contas de menores de 12).
// O link do e-mail abre a página quicksavegames.com.br/app/autorizar, onde o responsável confirma.
// Segredos (Supabase > Edge Functions > Secrets):
//   RESEND_API_KEY   chave da API do Resend
//   EMAIL_REMETENTE  ex.: Quicksave <noreply@quicksavegames.com.br>
//   AUTORIZAR_URL    (opcional) padrão: https://quicksavegames.com.br/app/autorizar

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

const ESPERA_ENTRE_ENVIOS_MS = 10 * 60 * 1000;

function resposta(dados: unknown, status = 200) {
  return new Response(JSON.stringify(dados), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function idade(nascimento: string): number {
  const [a, m, d] = nascimento.split('-').map(Number);
  const hoje = new Date();
  let anos = hoje.getFullYear() - a;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) anos--;
  return anos;
}

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function emailHtml(username: string, link: string) {
  const u = escapar(username);
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#ffeecc;font-family:Georgia,serif;color:#020000">
<div style="max-width:560px;margin:0 auto;padding:28px 22px">
  <p style="font-family:monospace;letter-spacing:2px;font-size:12px;margin:0 0 8px">QUICKSAVE</p>
  <h1 style="font-family:Arial Black,Arial,sans-serif;font-size:26px;line-height:1.15;margin:0 0 16px">@${u} quer usar o Quicksave</h1>
  <p style="font-size:17px;line-height:1.5">Olá! Uma criança indicou você como responsável ao criar a conta <strong>@${u}</strong> no Quicksave, um diário de jogos: a pessoa registra o que joga, dá notas e escreve o que achou.</p>
  <p style="font-size:17px;line-height:1.5">Enquanto você não autorizar, a conta funciona só como diário pessoal. Se autorizar, a criança poderá adicionar amigos, participar de grupos privados com amigos e ler comunidades. Para menores de 18, os registros ficam visíveis só para amigos, e ninguém de fora encontra o perfil pela busca.</p>
  <p style="margin:26px 0"><a href="${link}" style="background:#c21808;color:#ffeecc;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;font-size:17px;padding:14px 22px;border:3px solid #020000;border-radius:12px;display:inline-block">Ver e autorizar</a></p>
  <p style="font-size:15px;line-height:1.5">O link vale 7 dias. Antes de autorizar, leia os <a href="https://quicksavegames.com.br/app/termos" style="color:#8d3da4">termos de uso</a> e a <a href="https://quicksavegames.com.br/app/privacidade" style="color:#8d3da4">política de privacidade</a>.</p>
  <p style="font-size:15px;line-height:1.5">Não conhece essa conta? Ignore este e-mail: nada muda sem a sua autorização.</p>
</div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta({ erro: 'metodo' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: quem, error } = await admin.auth.getUser(token);
  if (error || !quem?.user) return resposta({ erro: 'nao_logado' }, 401);
  const userId = quem.user.id;

  const [{ data: privado }, { data: perfil }] = await Promise.all([
    admin.from('profile_private').select('birth_date, guardian_email, guardian_consent_at').eq('id', userId).maybeSingle(),
    admin.from('profiles').select('username').eq('id', userId).maybeSingle(),
  ]);
  if (!privado?.birth_date || !privado.guardian_email || !perfil?.username) return resposta({ erro: 'sem_responsavel' }, 400);
  if (idade(privado.birth_date) >= 12) return resposta({ erro: 'nao_precisa' }, 400);
  if (privado.guardian_consent_at) return resposta({ ok: true, ja_autorizado: true });

  // Um e-mail a cada 10 minutos, no máximo
  const { data: ultimo } = await admin
    .from('guardian_requests')
    .select('created_at')
    .eq('child_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultimo && Date.now() - new Date(ultimo.created_at).getTime() < ESPERA_ENTRE_ENVIOS_MS) {
    return resposta({ erro: 'aguarde' }, 429);
  }

  const chaveResend = Deno.env.get('RESEND_API_KEY');
  const remetente = Deno.env.get('EMAIL_REMETENTE');
  if (!chaveResend || !remetente) {
    console.error('responsavel: faltam os segredos RESEND_API_KEY e EMAIL_REMETENTE');
    return resposta({ erro: 'email_nao_configurado' }, 500);
  }

  const { data: pedido, error: erroPedido } = await admin
    .from('guardian_requests')
    .insert({ child_id: userId, email: privado.guardian_email })
    .select('token')
    .single();
  if (erroPedido || !pedido) return resposta({ erro: 'falhou' }, 500);

  const base = Deno.env.get('AUTORIZAR_URL') ?? 'https://quicksavegames.com.br/app/autorizar';
  const link = `${base}?token=${pedido.token}`;

  const envio = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chaveResend}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: remetente,
      to: [privado.guardian_email],
      subject: `@${perfil.username} pede sua autorização no Quicksave`,
      html: emailHtml(perfil.username, link),
    }),
  });
  if (!envio.ok) {
    console.error('responsavel: Resend respondeu', envio.status, await envio.text());
    await admin.from('guardian_requests').delete().eq('token', pedido.token);
    return resposta({ erro: 'falhou' }, 502);
  }
  return resposta({ ok: true });
});
