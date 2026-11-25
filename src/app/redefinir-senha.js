import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Aviso, Botao, Campo, LinkTexto, Tela, Texto, Titulo } from '../components/ui';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { erroSenha } from '../lib/validacao';

// Aberta pelo link do e-mail de "Esqueci a senha". O link já cria a sessão; aqui a pessoa escolhe a senha nova.
export default function RedefinirSenha() {
  const { logado, perfilCompleto } = useAuth();
  // Sem perfil completo, "/" (as abas) está bloqueado: vai direto para completar o perfil
  const sair = () => router.replace(logado && !perfilCompleto ? '/completar-perfil' : '/');
  const [temSessao, setTemSessao] = useState(null);
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let ativo = true;
    // O link pode demorar um instante para virar sessão
    const conferir = () => supabase.auth.getSession().then(({ data }) => ativo && setTemSessao(Boolean(data.session)));
    conferir();
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      if (ativo && (evento === 'PASSWORD_RECOVERY' || s)) setTemSessao(Boolean(s));
    });
    const t = setTimeout(conferir, 1500);
    return () => {
      ativo = false;
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function salvar() {
    setErro(null);
    const e = erroSenha(senha);
    if (e) return setErro(e);
    if (senha !== repetir) return setErro('As duas senhas não são iguais.');
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) {
      console.warn('redefinir senha:', error.message);
      return setErro(
        error.message?.toLowerCase().includes('different')
          ? 'A senha nova precisa ser diferente da antiga.'
          : 'Não foi possível salvar a senha. Peça um link novo em "Esqueci a senha".'
      );
    }
    setPronto(true);
  }

  return (
    <Tela>
      <View style={{ height: 24 }} />
      <Titulo>Senha nova</Titulo>
      {temSessao === false ? (
        <>
          <Texto>Este link não é válido ou já expirou. Os links valem por pouco tempo e só funcionam uma vez.</Texto>
          <Botao titulo="Pedir outro link" variante="destaque" onPress={() => router.replace('/esqueci-senha')} />
        </>
      ) : pronto ? (
        <>
          <Aviso tipo="sucesso">Senha alterada. Você já está dentro do app.</Aviso>
          <Botao titulo="Continuar" variante="destaque" onPress={sair} />
        </>
      ) : (
        <>
          <Texto>Escolha uma senha nova para a sua conta.</Texto>
          <Campo rotulo="Senha nova" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="new-password" />
          <Campo rotulo="Repita a senha" value={repetir} onChangeText={setRepetir} secureTextEntry autoComplete="new-password" />
          <Aviso>{erro}</Aviso>
          <View style={{ flex: 1 }} />
          <Botao titulo="Salvar senha" variante="destaque" onPress={salvar} carregando={salvando} desabilitado={!temSessao} />
          <LinkTexto titulo="Voltar ao início" onPress={sair} />
        </>
      )}
    </Tela>
  );
}
