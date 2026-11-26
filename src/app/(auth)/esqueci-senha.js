import { useState } from 'react';
import { View } from 'react-native';
import { Aviso, Botao, Campo, Tela, Texto } from '../../components/ui';
import { Cabecalho } from '../../components/Cabecalho';
import { supabase } from '../../lib/supabase';
import { erroEmail } from '../../lib/validacao';
import { linkRedefinirSenha } from '../../lib/conta';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState(null);
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function enviar() {
    setErro(null);
    const e = erroEmail(email);
    if (e) {
      setErro(e);
      return;
    }
    setCarregando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: linkRedefinirSenha() });
    setCarregando(false);
    if (error) setErro('Não foi possível enviar agora. Tente de novo em alguns minutos.');
    else setEnviado(true);
  }

  return (
    <Tela rodape>
      <Cabecalho titulo="Esqueci a senha" />
      <Texto>Digite seu e-mail e enviaremos um link para criar uma senha nova.</Texto>
      <Campo rotulo="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
      <Aviso>{erro}</Aviso>
      <Aviso tipo="sucesso">{enviado ? 'Pronto. Se esse e-mail tiver conta, o link chega em alguns minutos.' : null}</Aviso>
      <View style={{ flex: 1 }} />
      <Botao titulo="Enviar link" variante="destaque" onPress={enviar} carregando={carregando} />
    </Tela>
  );
}
