import { useState } from 'react';
import { View } from 'react-native';
import { Aviso } from './ui';
import { BotaoPequeno } from './social';
import { useAuth } from '../lib/auth';
import { pedirAutorizacao } from '../lib/conta';

/** Menor de 12 sem autorização: explica e deixa reenviar o e-mail ao responsável. */
export function AvisoResponsavel({ texto }) {
  const { privado, recarregarPerfil } = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  async function reenviar() {
    setEnviando(true);
    const r = await pedirAutorizacao();
    setEnviando(false);
    if (r.jaAutorizado) {
      await recarregarPerfil();
      return;
    }
    setResultado(r.erro ? { tipo: 'erro', msg: r.erro } : { tipo: 'sucesso', msg: 'E-mail enviado. Peça para seu responsável olhar a caixa de entrada (e o spam).' });
  }

  return (
    <View style={{ gap: 10 }}>
      <Aviso tipo="info">
        {texto} Enviamos um e-mail para {privado?.guardian_email || 'o seu responsável'} com o link de autorização.
      </Aviso>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <BotaoPequeno titulo={enviando ? 'Enviando...' : 'Reenviar e-mail'} onPress={reenviar} desabilitado={enviando} />
        <BotaoPequeno titulo="Já autorizou? Atualizar" onPress={recarregarPerfil} />
      </View>
      {resultado ? <Aviso tipo={resultado.tipo}>{resultado.msg}</Aviso> : null}
    </View>
  );
}

/** Conta suspensa pelo admin. */
export function AvisoSuspensa() {
  const { suspensa, perfil } = useAuth();
  if (!suspensa) return null;
  return (
    <Aviso>
      Sua conta está suspensa{perfil?.suspended_reason ? ` (${perfil.suspended_reason})` : ''}. Você ainda pode usar o seu diário,
      mas não pode comentar, reagir, postar nem adicionar amigos. Dúvidas: contato pelo site quicksavegames.com.br.
    </Aviso>
  );
}
