import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Aviso, Botao, Campo, LinkTexto, Tela } from '../../components/ui';
import { Cabecalho } from '../../components/Cabecalho';
import { supabase } from '../../lib/supabase';
import { erroEmail } from '../../lib/validacao';

export default function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    setErro(null);
    if (erroEmail(email) || !senha) {
      setErro('Preencha e-mail e senha.');
      return;
    }
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setCarregando(false);
    if (error) {
      if (error.code === 'email_not_confirmed') setErro('Confirme seu e-mail pelo link que enviamos antes de entrar.');
      else if (error.code === 'invalid_credentials') setErro('E-mail ou senha incorretos.');
      else setErro('Não foi possível entrar agora. Tente de novo.');
    }
    // Com sucesso, a navegação troca de tela sozinha (Stack.Protected no _layout)
  }

  return (
    <Tela>
      <Cabecalho titulo="Entrar" />
      <Campo rotulo="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Campo rotulo="Senha" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={entrar} />
      <Aviso>{erro}</Aviso>
      <View style={{ alignItems: 'flex-start' }}>
        <LinkTexto titulo="Esqueci minha senha" onPress={() => router.push('/esqueci-senha')} />
      </View>
      <View style={{ flex: 1 }} />
      <Botao titulo="Entrar" variante="destaque" onPress={entrar} carregando={carregando} />
    </Tela>
  );
}
