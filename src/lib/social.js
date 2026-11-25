// Amizades, grupos, feed, reações, comentários, curtidas e notificações.
// Tudo passa por funções do banco (supabase/migrations/004_social.sql), que checam quem pode o quê.
import { supabase } from './supabase';

const MENSAGENS = {
  precisa_responsavel: 'Para fazer amizades e participar de grupos, falta a autorização do seu responsável.',
  nao_disponivel: 'Não é possível enviar pedido para essa pessoa agora.',
  pessoa_nao_encontrada: 'Pessoa não encontrada.',
  limite_pedidos_dia: 'Você já enviou muitos pedidos hoje. Tente de novo amanhã.',
  limite_pedidos_pendentes: 'Você tem muitos pedidos esperando resposta. Cancele alguns antes de enviar outros.',
  pedido_nao_encontrado: 'Esse pedido não existe mais.',
  limite_grupos: 'Você já criou 10 grupos, que é o máximo.',
  so_amigos: 'Só dá para convidar amigos para o grupo.',
  grupo_cheio: 'O grupo já tem 20 pessoas, contando os convites.',
  convite_nao_encontrado: 'Esse convite não existe mais.',
  limite_comentarios: 'Calma! Espere um pouco antes de comentar de novo.',
  propria_review: 'Você não pode curtir a sua própria review.',
  sem_acesso: 'Você não tem acesso a isso.',
  conta_suspensa: 'Sua conta está suspensa: não é possível fazer isso agora.',
};

function traduzir(error, padrao = 'Não foi possível fazer isso agora. Tente de novo.') {
  const msg = error?.message || '';
  const chave = Object.keys(MENSAGENS).find((k) => msg.includes(k));
  if (!chave) console.warn('social:', msg);
  return chave ? MENSAGENS[chave] : padrao;
}

async function rpc(nome, args, padraoErro) {
  const { data, error } = await supabase.rpc(nome, args);
  if (error) return { erro: traduzir(error, padraoErro) };
  return { dados: data };
}

async function lista(nome, args) {
  const r = await rpc(nome, args);
  return r.erro ? [] : r.dados || [];
}

// ---------- Pessoas e amizades ----------
export const buscarPessoas = (q) => lista('search_profiles', { p_q: q });

export async function perfilPublico(username) {
  const r = await rpc('profile_view', { p_username: username });
  if (r.erro) return { erro: r.erro };
  return { perfil: (r.dados || [])[0] || null };
}

export const enviarPedido = (id) => rpc('send_friend_request', { p_user: id });
export const responderPedido = (id, aceitar) => rpc('respond_friend_request', { p_user: id, p_accept: aceitar });
export const desfazerAmizade = (id) => rpc('remove_friend', { p_user: id });
export const bloquear = (id) => rpc('block_user', { p_user: id });
export const desbloquear = (id) => rpc('unblock_user', { p_user: id });
export const meusAmigos = () => lista('my_friends');
export const pedidosDeAmizade = () => lista('friend_requests');
export const meusBloqueios = () => lista('my_blocks');

// ---------- Grupos ----------
export const criarGrupo = (nome, descricao) => rpc('create_group', { p_name: nome, p_description: descricao });
export const editarGrupo = (id, nome, descricao) => rpc('update_group', { p_group: id, p_name: nome, p_description: descricao });
export const convidarParaGrupo = (grupo, pessoa) => rpc('invite_to_group', { p_group: grupo, p_user: pessoa });
export const responderConvite = (grupo, aceitar) => rpc('respond_group_invite', { p_group: grupo, p_accept: aceitar });
export const sairDoGrupo = (grupo) => rpc('leave_group', { p_group: grupo });
export const tirarDoGrupo = (grupo, pessoa) => rpc('remove_group_member', { p_group: grupo, p_user: pessoa });
export const apagarGrupo = (grupo) => rpc('delete_group', { p_group: grupo });
export const avisosDoGrupo = (grupo, ligado) => rpc('set_group_notify', { p_group: grupo, p_on: ligado });
export const meusGrupos = () => lista('my_groups');
export const membrosDoGrupo = (grupo) => lista('group_members_list', { p_group: grupo });

// ---------- Feed ----------
export const POR_PAGINA = 20;

export function feedAmigos(antesDe) {
  return lista('activity_feed', { p_scope: 'friends', p_before: antesDe || null, p_limit: POR_PAGINA });
}
export function feedGrupo(grupo, antesDe) {
  return lista('activity_feed', { p_scope: 'group', p_group: grupo, p_before: antesDe || null, p_limit: POR_PAGINA });
}
export function feedPessoa(userId, antesDe) {
  return lista('activity_feed', { p_scope: 'user', p_user: userId, p_before: antesDe || null, p_limit: POR_PAGINA });
}
export async function atividade(eventId) {
  const itens = await lista('activity_feed', { p_scope: 'event', p_event: eventId, p_limit: 1 });
  return itens[0] || null;
}

// ---------- Reações e comentários ----------
export const REACOES = [
  { valor: 'curti', rotulo: 'Curti' },
  { valor: 'quero', rotulo: 'Quero jogar' },
  { valor: 'gg', rotulo: 'GG' },
];

export const reagir = (eventId, tipo) => rpc('react_to_event', { p_event: eventId, p_kind: tipo });
export const comentar = (eventId, texto, spoiler = false) =>
  rpc('add_comment', { p_event: eventId, p_body: texto, p_spoiler: spoiler });
export const apagarComentario = (id) => rpc('delete_comment', { p_id: id });
export const comentarios = (eventId) => lista('event_comments_list', { p_event: eventId });

// ---------- Reviews ----------
export const curtirReview = (dono, jogo) => rpc('toggle_review_like', { p_owner: dono, p_game: jogo });
export const reviewsDoJogo = (jogo) => lista('reviews_for_game', { p_game: jogo });
export const reviewsEmAlta = () => lista('trending_reviews', { p_limit: 10 });
export const jogosPopulares = () => lista('popular_games', { p_days: 7, p_limit: 12 });

// ---------- Notificações ----------
export const minhasNotificacoes = () => lista('my_notifications', { p_limit: 60 });
export const marcarNotificacoesLidas = () => rpc('mark_notifications_read');

export async function contagens() {
  const r = await rpc('badge_counts');
  const c = (r.dados || [])[0];
  return { notificacoes: c?.notifications || 0, pedidos: c?.friend_requests || 0, convites: c?.group_invites || 0 };
}

// ---------- Textos ----------
const VERBOS = {
  wishlisted: 'quer jogar',
  started: 'começou',
  finished: 'zerou',
  dropped: 'largou',
  rated: 'avaliou',
  reviewed: 'escreveu sobre',
};
export const verboAtividade = (tipo) => VERBOS[tipo] || 'registrou';

export function textoHoras(horas, tipo) {
  if (horas === null || horas === undefined) return null;
  const h = `${horas} h`;
  return tipo === 'dropped' ? `depois de ${h}` : `em ${h}`;
}

/** "agora", "há 5 min", "há 3 h", "há 2 d" ou a data. */
export function tempoRelativo(iso) {
  if (!iso) return '';
  const seg = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seg < 60) return 'agora';
  if (seg < 3600) return `há ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `há ${Math.floor(seg / 3600)} h`;
  if (seg < 86400 * 7) return `há ${Math.floor(seg / 86400)} d`;
  const d = new Date(iso);
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mesmoAno = d.getFullYear() === new Date().getFullYear();
  return `${d.getDate()} ${meses[d.getMonth()]}${mesmoAno ? '' : ` ${d.getFullYear()}`}`;
}

export function textoNotificacao(n) {
  const quem = n.actor_username ? `@${n.actor_username}` : 'Alguém';
  switch (n.type) {
    case 'friend_request':
      return `${quem} quer ser seu amigo.`;
    case 'friend_accepted':
      return `${quem} aceitou seu pedido de amizade.`;
    case 'group_invite':
      return `${quem} convidou você para o grupo ${n.group_name || ''}.`;
    case 'reaction':
      return `${quem} reagiu à sua atividade${n.game_name ? ` em ${n.game_name}` : ''}.`;
    case 'comment':
      return `${quem} comentou na sua atividade${n.game_name ? ` em ${n.game_name}` : ''}.`;
    case 'review_like':
      return `${quem} curtiu sua review${n.game_name ? ` de ${n.game_name}` : ''}.`;
    case 'group_activity':
      return `${quem} ${verboAtividade(n.event_type)} ${n.game_name || 'um jogo'}${n.group_name ? ` · ${n.group_name}` : ''}.`;
    case 'post_reply':
      return `${quem} respondeu seu tópico${n.post_title ? ` "${n.post_title}"` : ''}${n.community_name ? ` em ${n.community_name}` : ''}.`;
    case 'mod_action':
      return `A moderação${n.community_name ? ` de ${n.community_name}` : ''} removeu um conteúdo seu${n.post_title ? ` no tópico "${n.post_title}"` : ''}.`;
    case 'rewind':
      return 'Seu Rewind chegou! Toque para ver sua retrospectiva.';
    case 'report':
      return n.community_name ? `Nova denúncia para analisar em ${n.community_name}.` : 'Nova denúncia para analisar.';
    default:
      return 'Novidade no Quicksave.';
  }
}

/** Para onde levar quem toca na notificação. */
export function destinoNotificacao(n) {
  if (n.type === 'report') return '/denuncias';
  if (n.type === 'rewind') return '/rewinds';
  if (n.post_id) return `/topico/${n.post_id}`;
  if (n.event_id) return `/atividade/${n.event_id}`;
  if (n.type === 'review_like' && n.game_id) return `/jogo/${n.game_id}`;
  if (n.type === 'group_invite' && n.group_id) return `/grupo/${n.group_id}`;
  if (n.actor_username) return `/u/${n.actor_username}`;
  return null;
}
