import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { sairDoGoogle } from './google';
import { IDADE_RESPONSAVEL, idade } from './validacao';
import { VERSAO_TERMOS } from './termos';

const AuthContext = createContext(null);

async function buscarPerfil(userId) {
  const [{ data: perfil }, { data: privado }] = await Promise.all([
    supabase.from('profiles').select('id, username, display_name, avatar_url, bio, role, suspended_at, suspended_reason').eq('id', userId).maybeSingle(),
    supabase.from('profile_private').select('birth_date, guardian_email, guardian_consent_at, terms_version, terms_accepted_at').eq('id', userId).maybeSingle(),
  ]);
  return { perfil, privado };
}

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [privado, setPrivado] = useState(null);
  const [carregando, setCarregando] = useState(true);
  // id do usuário cujo perfil já foi buscado (evita piscar "Completar perfil" logo após o login)
  const [perfilDe, setPerfilDe] = useState(null);

  const carregarPerfil = useCallback(async (s) => {
    if (!s?.user) {
      setPerfil(null);
      setPrivado(null);
      setPerfilDe(null);
      return;
    }
    const r = await buscarPerfil(s.user.id);
    setPerfil(r.perfil);
    setPrivado(r.privado);
    setPerfilDe(s.user.id);
  }, []);

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!ativo) return;
      setSessao(data.session);
      await carregarPerfil(data.session);
      if (ativo) setCarregando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSessao(s);
      // Não usar await dentro do callback (recomendação do Supabase): agenda a busca
      setTimeout(() => carregarPerfil(s), 0);
    });
    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, [carregarPerfil]);

  const valor = useMemo(() => {
    const nascimento = privado?.birth_date;
    const anos = nascimento ? idade(nascimento) : null;
    const precisaResponsavel = anos !== null && anos < IDADE_RESPONSAVEL;
    const aceitouTermos = privado?.terms_version === VERSAO_TERMOS;
    const perfilCompleto = Boolean(
      perfil?.username && nascimento && (!precisaResponsavel || privado?.guardian_email) && aceitouTermos
    );
    return {
      sessao,
      perfil,
      privado,
      carregando: carregando || Boolean(sessao && perfilDe !== sessao.user.id),
      logado: Boolean(sessao),
      perfilCompleto,
      aceitouTermos,
      menorDeIdade: anos !== null && anos < 18,
      // Menor de 12 sem autorização do responsável: ainda sem amizades, grupos e interações
      precisaAutorizacao: precisaResponsavel && !privado?.guardian_consent_at,
      suspensa: Boolean(perfil?.suspended_at),
      recarregarPerfil: () => carregarPerfil(sessao),
      sair: async () => {
        await sairDoGoogle();
        await supabase.auth.signOut();
      },
    };
  }, [sessao, perfil, privado, carregando, perfilDe, carregarPerfil]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
