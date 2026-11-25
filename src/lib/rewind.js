// Rewind: leitura para cada pessoa e controle do admin (supabase/migrations/009_rewind.sql).
import { supabase } from './supabase';

async function rpc(nome, args) {
  const { data, error } = await supabase.rpc(nome, args);
  if (error) {
    console.warn('rewind:', error.message);
    const msg = error.message || '';
    if (msg.includes('sem_acesso')) return { erro: 'Só admins podem fazer isso.' };
    if (msg.includes('periodo_nao_encontrado')) return { erro: 'Período não encontrado.' };
    if (msg.includes('rewind_periods_id_check')) return { erro: 'Código inválido. Use 2026 (ano) ou 2026-11 (mês).' };
    return { erro: 'Não foi possível fazer isso agora. Tente de novo.' };
  }
  return { dados: data };
}

export async function meusRewinds() {
  const r = await rpc('my_rewinds');
  return r.dados || [];
}

export async function abrirRewind(periodo) {
  const r = await rpc('rewind_view', { p_period: periodo });
  return (r.dados || [])[0] || null;
}

// ---------- Admin ----------
export async function periodosAdmin() {
  const r = await rpc('admin_rewind_periods');
  return r.dados || [];
}
export const criarPeriodo = (id, tipo, titulo, inicio, fim) =>
  rpc('admin_create_rewind_period', { p_id: id, p_kind: tipo, p_title: titulo, p_start: inicio, p_end: fim });
export const gerarRewind = (id) => rpc('admin_generate_rewind', { p_period: id });
export const publicarRewind = (id, publicar) => rpc('admin_publish_rewind', { p_period: id, p_publish: publicar });
export const apagarPeriodo = (id) => rpc('admin_delete_rewind_period', { p_period: id });

// ---------- Textos ----------
export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const MESES_CURTOS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** "2026" ou "novembro" (para frases como "Seu 2026"). */
export function nomeDoPeriodo(p) {
  if (!p) return '';
  if (p.kind === 'year') return String(p.starts_on).slice(0, 4);
  return MESES[Number(String(p.starts_on).slice(5, 7)) - 1];
}

export const numero = (n) => Number(n || 0).toLocaleString('pt-BR');

/** Selo do perfil de jogador, por regras simples. No mensal, as metas são menores. */
export function perfilDeJogador(d, tipo) {
  const mes = tipo === 'month';
  const m = (anual, mensal) => (mes ? mensal : anual);
  if ((d.zerados || 0) >= m(5, 2) && d.zerados >= (d.jogos || 0) / 2) {
    return { chave: 'zerador', titulo: 'Zerador', descricao: 'Começou, terminou. Você fecha o que abre.' };
  }
  if ((d.reviews || 0) >= m(5, 2)) {
    return { chave: 'critico', titulo: 'Crítico', descricao: 'Sua opinião vem por escrito, e o pessoal lê.' };
  }
  if ((d.horas || 0) >= m(100, 30)) {
    return { chave: 'maratonista', titulo: 'Maratonista', descricao: 'Controle na mão por horas e horas.' };
  }
  if ((d.generos_distintos || 0) >= m(6, 4)) {
    return { chave: 'explorador', titulo: 'Explorador', descricao: 'De terror a corrida: você prova de tudo.' };
  }
  if ((d.quero_jogar || 0) >= m(10, 4)) {
    return { chave: 'colecionador', titulo: 'Colecionador', descricao: 'A lista de "quero jogar" só cresce.' };
  }
  return { chave: 'tranquilo', titulo: 'Jogador tranquilo', descricao: 'No seu ritmo, sem pressa nenhuma.' };
}
