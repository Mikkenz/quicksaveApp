// Regras de cadastro, iguais às do banco (supabase/migrations/001_base.sql)

export const REGEX_USUARIO = /^[a-z0-9_]{3,20}$/;

export function normalizarUsuario(texto) {
  return texto.trim().replace(/^@/, '').toLowerCase();
}

export function erroUsuario(usuario) {
  if (!usuario) return 'Escolha um @usuário.';
  if (!REGEX_USUARIO.test(usuario)) return 'Use de 3 a 20 letras minúsculas, números ou _.';
  return null;
}

export function erroEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Digite um e-mail válido.';
  return null;
}

export function erroSenha(senha) {
  if (senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  return null;
}

/** Aceita DD/MM/AAAA e devolve 'AAAA-MM-DD' ou null. */
export function lerData(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const [, d, mes, a] = m.map(Number);
  const data = new Date(Date.UTC(a, mes - 1, d));
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== d) return null;
  if (a < 1900 || data > new Date()) return null;
  return `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Coloca as barras enquanto a pessoa digita a data. */
export function mascaraData(texto) {
  const n = texto.replace(/\D/g, '').slice(0, 8);
  if (n.length <= 2) return n;
  if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
}

export function idade(isoData) {
  const [a, m, d] = isoData.split('-').map(Number);
  const hoje = new Date();
  let anos = hoje.getFullYear() - a;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) anos -= 1;
  return anos;
}

export const IDADE_RESPONSAVEL = 12; // abaixo disso, precisa de responsável
export const MAIORIDADE = 18;
