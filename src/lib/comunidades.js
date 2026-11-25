// Comunidades, tópicos, respostas, moderação e denúncias (supabase/migrations/006_comunidades.sql).
import { supabase } from './supabase';

const MENSAGENS = {
  so_adultos: 'No beta, só maiores de 18 anos podem criar comunidades, postar e responder.',
  precisa_responsavel: 'Para participar de comunidades, falta a autorização do seu responsável.',
  limite_comunidades: 'Você já criou 3 comunidades, que é o máximo.',
  endereco_invalido: 'O endereço precisa ter de 3 a 36 letras, números ou hífens.',
  endereco_em_uso: 'Esse endereço já está em uso. Escolha outro.',
  comunidade_nao_encontrada: 'Comunidade não encontrada.',
  banido: 'Você foi banido desta comunidade.',
  dono_nao_sai: 'Quem criou a comunidade não pode sair. Você pode apagá-la em Gerenciar.',
  nao_e_membro: 'Essa pessoa não participa da comunidade.',
  limite_moderadores: 'A comunidade já tem 5 moderadores.',
  precisa_participar: 'Toque em Participar para postar nesta comunidade.',
  limite_topicos: 'Você criou muitos tópicos na última hora. Tente de novo mais tarde.',
  limite_respostas: 'Você respondeu muitas vezes na última hora. Tente de novo mais tarde.',
  topico_nao_encontrado: 'Esse tópico não está mais disponível.',
  resposta_nao_encontrada: 'Essa resposta não está mais disponível.',
  topico_trancado: 'Este tópico foi trancado pela moderação.',
  limite_denuncias: 'Você enviou muitas denúncias na última hora. Tente de novo mais tarde.',
  alvo_nao_encontrado: 'Esse conteúdo não existe mais.',
  acao_invalida: 'Ação inválida.',
  sem_acesso: 'Você não tem acesso a isso.',
  conta_suspensa: 'Sua conta está suspensa: não é possível fazer isso agora.',
};

function traduzir(error, padrao = 'Não foi possível fazer isso agora. Tente de novo.') {
  const msg = error?.message || '';
  const chave = Object.keys(MENSAGENS).find((k) => msg.includes(k));
  if (!chave) console.warn('comunidades:', msg);
  return chave ? MENSAGENS[chave] : padrao;
}

async function rpc(nome, args) {
  const { data, error } = await supabase.rpc(nome, args);
  if (error) return { erro: traduzir(error) };
  return { dados: data };
}

async function lista(nome, args) {
  const r = await rpc(nome, args);
  return r.erro ? [] : r.dados || [];
}

async function um(nome, args) {
  const r = await rpc(nome, args);
  return r.erro ? null : (r.dados || [])[0] || null;
}

export const TIPOS_TOPICO = [
  { valor: 'discussao', rotulo: 'Discussão' },
  { valor: 'indicacao', rotulo: 'Indicação' },
  { valor: 'pergunta', rotulo: 'Pergunta' },
];
export const rotuloTipo = (v) => TIPOS_TOPICO.find((t) => t.valor === v)?.rotulo || v;

export const MOTIVOS_DENUNCIA = [
  { valor: 'spam', rotulo: 'Spam ou propaganda' },
  { valor: 'ofensa', rotulo: 'Ofensa ou assédio' },
  { valor: 'adulto', rotulo: 'Conteúdo adulto' },
  { valor: 'spoiler', rotulo: 'Spoiler sem aviso' },
  { valor: 'outro', rotulo: 'Outro motivo' },
];
export const rotuloMotivo = (v) => MOTIVOS_DENUNCIA.find((m) => m.valor === v)?.rotulo || v;

/** "Jogos de Terror!" -> "jogos-de-terror" */
export function criarEndereco(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36)
    .replace(/-+$/g, '');
}

// ---------- Comunidades ----------
export const criarComunidade = (nome, endereco, descricao, regras) =>
  rpc('create_community', { p_name: nome, p_slug: endereco, p_description: descricao, p_rules: regras });
export const editarComunidade = (id, nome, descricao, regras) =>
  rpc('update_community', { p_id: id, p_name: nome, p_description: descricao, p_rules: regras });
export const apagarComunidade = (id) => rpc('delete_community', { p_id: id });
export const participar = (id) => rpc('join_community', { p_id: id });
export const sairDaComunidade = (id) => rpc('leave_community', { p_id: id });
export const marcarVista = (id) => rpc('mark_community_seen', { p_id: id });
export const definirModerador = (id, pessoa, ligado) => rpc('set_moderator', { p_id: id, p_user: pessoa, p_on: ligado });
export const banir = (id, pessoa, motivo) => rpc('ban_member', { p_id: id, p_user: pessoa, p_reason: motivo || null });
export const desbanir = (id, pessoa) => rpc('unban_member', { p_id: id, p_user: pessoa });

export const comunidade = (endereco) => um('community_view', { p_slug: endereco });
export const buscarComunidades = (q) => lista('search_communities', { p_q: q });
export const comunidadesEmAlta = () => lista('trending_communities', { p_limit: 10 });
export const minhasComunidades = () => lista('my_communities');
export const membrosDaComunidade = (id) => lista('community_members_list', { p_id: id });
export const banidosDaComunidade = (id) => lista('community_bans_list', { p_id: id });

// ---------- Tópicos e respostas ----------
export const TOPICOS_POR_PAGINA = 20;

export const topicos = (comunidadeId, tipo, offset = 0) =>
  lista('community_posts_list', { p_community: comunidadeId, p_kind: tipo || null, p_offset: offset, p_limit: TOPICOS_POR_PAGINA });
export const topico = (id) => um('post_view', { p_id: id });
export const buscarTopicos = (q, comunidadeId) =>
  lista('search_posts', { p_q: q, p_community: comunidadeId || null, p_limit: 30 });
export const respostas = (id) => lista('post_replies', { p_post: id });

export const criarTopico = (comunidadeId, tipo, titulo, texto, jogos, spoiler = false) =>
  rpc('create_post', { p_community: comunidadeId, p_kind: tipo, p_title: titulo, p_body: texto, p_games: jogos, p_spoiler: spoiler });
export const editarTopico = (id, tipo, titulo, texto, jogos, spoiler = false) =>
  rpc('edit_post', { p_id: id, p_kind: tipo, p_title: titulo, p_body: texto, p_games: jogos, p_spoiler: spoiler });
export const apagarTopico = (id) => rpc('delete_post', { p_id: id });
export const responder = (topicoId, texto, jogos, spoiler = false) =>
  rpc('create_reply', { p_post: topicoId, p_body: texto, p_games: jogos, p_spoiler: spoiler });
export const editarResposta = (id, texto, jogos, spoiler = false) =>
  rpc('edit_reply', { p_id: id, p_body: texto, p_games: jogos, p_spoiler: spoiler });
export const apagarResposta = (id) => rpc('delete_reply', { p_id: id });
export const curtirTopico = (id) => rpc('toggle_post_like', { p_id: id });
export const curtirResposta = (id) => rpc('toggle_reply_like', { p_id: id });
export const moderarTopico = (id, acao) => rpc('moderate_post', { p_id: id, p_action: acao });
export const moderarResposta = (id, acao) => rpc('moderate_reply', { p_id: id, p_action: acao });

// ---------- Denúncias ----------
export const denunciar = (tipo, alvo, motivo, detalhes) =>
  rpc('report_content', { p_type: tipo, p_target: String(alvo), p_reason: motivo, p_details: detalhes || null });
export const filaDeDenuncias = () => lista('reports_queue', { p_status: 'open' });
export const resolverDenuncia = (tipo, alvo, acao) => rpc('resolve_report', { p_type: tipo, p_target: alvo, p_action: acao });
export const resumoDenuncias = () => um('reports_summary');
