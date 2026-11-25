// Edge Function "igdb": única porta do app para o IGDB.
// - Só aceita quem está logado (verify_jwt ligado + conferência do usuário).
// - Guarda o token da Twitch, as buscas (24 h) e os jogos (tabela games).
// - Limita as buscas por pessoa e tenta de novo se o IGDB pedir para esperar.
// Segredos necessários (Supabase > Edge Functions > Secrets): TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, traceparent, tracestate, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUSCAS_POR_MINUTO = 30;
const CACHE_BUSCA_MS = 24 * 60 * 60 * 1000;
const CACHE_JOGO_MS = 7 * 24 * 60 * 60 * 1000;
// Tipos que não são um jogo inteiro (DLC, expansão, pacote, mod, episódio, temporada, pack, update)
const TIPOS_DLC = new Set([1, 2, 3, 5, 6, 7, 13, 14]);
const TEMA_EROTICO = 42;

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
  return new Response(JSON.stringify(dados), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const limpar = (s: string) => s.replace(/\\/g, ' ').replace(/"/g, ' ').replace(/[;\r\n]/g, ' ').trim();

// ---------- Twitch / IGDB ----------
async function tokenTwitch(forcar = false): Promise<string> {
  if (!forcar) {
    const { data } = await admin.from('igdb_token').select('token, expires_at').eq('id', 1).maybeSingle();
    if (data && new Date(data.expires_at).getTime() > Date.now() + 60_000) return data.token;
  }
  const id = Deno.env.get('TWITCH_CLIENT_ID');
  const segredo = Deno.env.get('TWITCH_CLIENT_SECRET');
  if (!id || !segredo) throw new Error('Faltam os segredos TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET');
  const r = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${segredo}&grant_type=client_credentials`,
    { method: 'POST' },
  );
  const json = await r.json();
  if (!json.access_token) throw new Error('A Twitch recusou as chaves');
  const expira = new Date(Date.now() + Math.max(60, (json.expires_in ?? 3600) - 300) * 1000).toISOString();
  await admin.from('igdb_token').upsert({ id: 1, token: json.access_token, expires_at: expira });
  return json.access_token;
}

async function igdb(endpoint: string, corpo: string, tentativa = 0): Promise<any[]> {
  const token = await tokenTwitch(tentativa > 0);
  const r = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': Deno.env.get('TWITCH_CLIENT_ID')!,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: corpo,
  });
  // 429 = passou de 4 pedidos por segundo; 401 = token vencido
  if ((r.status === 429 || r.status === 401) && tentativa < 2) {
    await esperar(400 * (tentativa + 1));
    return igdb(endpoint, corpo, tentativa + 1);
  }
  const dados = await r.json().catch(() => null);
  if (!Array.isArray(dados)) throw new Error(`IGDB respondeu ${r.status}`);
  return dados;
}

// ---------- formato dos jogos ----------
const CAMPOS_BASE = `name, slug, first_release_date, game_type, cover.image_id, genres.name, themes.id,
  platforms.abbreviation, platforms.name, involved_companies.developer, involved_companies.company.name`;

function formatar(x: any, detalhado: boolean) {
  const empresas = (x.involved_companies ?? []).filter((c: any) => c?.company?.name);
  const dev = empresas.find((c: any) => c.developer)?.company?.name ?? empresas[0]?.company?.name ?? null;
  return {
    igdb_id: x.id,
    name: String(x.name).slice(0, 200),
    slug: x.slug ?? null,
    cover_image_id: x.cover?.image_id ?? null,
    first_release: x.first_release_date ? new Date(x.first_release_date * 1000).toISOString().slice(0, 10) : null,
    platforms: [...new Set((x.platforms ?? []).map((p: any) => p.abbreviation || p.name).filter(Boolean))].slice(0, 12),
    genres: (x.genres ?? []).map((g: any) => g.name).filter(Boolean).slice(0, 6),
    developer: dev ? String(dev).slice(0, 120) : null,
    ...(detalhado
      ? { summary: x.summary ? String(x.summary).slice(0, 3000) : null, detailed: true }
      : {}),
    fetched_at: new Date().toISOString(),
  };
}

const ehJogoValido = (x: any) =>
  x?.name && !TIPOS_DLC.has(x.game_type) && !(x.themes ?? []).some((t: any) => t.id === TEMA_EROTICO);

// ---------- ações ----------
async function buscar(qBruto: string, userId: string) {
  const q = limpar(String(qBruto ?? '')).toLowerCase().slice(0, 60);
  if (q.length < 2) return { itens: [] };

  const { data: cache } = await admin.from('igdb_search_cache').select('results, fetched_at').eq('q', q).maybeSingle();
  if (cache && Date.now() - new Date(cache.fetched_at).getTime() < CACHE_BUSCA_MS) {
    return { itens: cache.results, cache: true };
  }

  const { data: dentro } = await admin.rpc('igdb_rate_hit', { p_user: userId, p_max: BUSCAS_POR_MINUTO });
  if (dentro === false) return { erro: 'limite', mensagem: 'Muitas buscas em pouco tempo. Espere um minuto.' };

  const brutos = await igdb('games', `search "${q}"; fields ${CAMPOS_BASE}; limit 30;`);
  const itens = brutos.filter(ehJogoValido).slice(0, 20).map((x) => formatar(x, false));

  if (itens.length) {
    // Grava os jogos (sem apagar a ficha completa de quem já tinha)
    await admin.from('games').upsert(itens, { onConflict: 'igdb_id', ignoreDuplicates: false });
  }
  await admin.from('igdb_search_cache').upsert({ q, results: itens, fetched_at: new Date().toISOString() });
  return { itens };
}

async function jogo(idBruto: unknown, userId: string) {
  const id = Number(idBruto);
  if (!Number.isInteger(id) || id <= 0) return { erro: 'id_invalido' };

  const { data: salvo } = await admin.from('games').select('*').eq('igdb_id', id).maybeSingle();
  if (salvo?.detailed && Date.now() - new Date(salvo.fetched_at).getTime() < CACHE_JOGO_MS) {
    return { jogo: salvo };
  }

  const { data: dentro } = await admin.rpc('igdb_rate_hit', { p_user: userId, p_max: BUSCAS_POR_MINUTO });
  if (dentro === false) {
    return salvo ? { jogo: salvo } : { erro: 'limite', mensagem: 'Muitos pedidos em pouco tempo. Espere um minuto.' };
  }

  const [x] = await igdb('games', `fields ${CAMPOS_BASE}, summary; where id = ${id}; limit 1;`);
  if (!x) return salvo ? { jogo: salvo } : { erro: 'nao_encontrado' };
  const linha = formatar(x, true);
  const { data } = await admin.from('games').upsert(linha, { onConflict: 'igdb_id' }).select('*').single();
  return { jogo: data ?? linha };
}

// ---------- entrada ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta({ erro: 'metodo' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: usuario } = await admin.auth.getUser(token);
  if (!usuario?.user) return resposta({ erro: 'login' }, 401);

  try {
    const corpo = await req.json().catch(() => ({}));
    if (corpo.acao === 'buscar') return resposta(await buscar(corpo.q, usuario.user.id));
    if (corpo.acao === 'jogo') return resposta(await jogo(corpo.id, usuario.user.id));
    return resposta({ erro: 'acao' }, 400);
  } catch (e) {
    console.error('igdb:', (e as Error).message);
    return resposta({ erro: 'igdb', mensagem: 'Não foi possível falar com o IGDB agora. Tente de novo.' }, 502);
  }
});
