import { useState } from 'react';
import { View } from 'react-native';
import Constants from 'expo-constants';
import { Aviso, Botao, Campo, Cartao, Rotulo, Tela, Texto } from '../components/ui';
import { Cabecalho } from '../components/Cabecalho';
import { LinksTermos } from '../components/LinksTermos';
import { useAuth } from '../lib/auth';
import { baixarMeusDados, excluirConta } from '../lib/conta';

// Minha conta: baixar meus dados e excluir a conta (LGPD)
export default function Conta() {
  const { perfil, sessao } = useAuth();
  const [baixando, setBaixando] = useState(false);
  const [msgDados, setMsgDados] = useState(null);
  const [abrirExclusao, setAbrirExclusao] = useState(false);
  const [confirmacao, setConfirmacao] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState(null);

  async function baixar() {
    setMsgDados(null);
    setBaixando(true);
    const r = await baixarMeusDados();
    setBaixando(false);
    setMsgDados(r.erro ? { tipo: 'erro', msg: r.erro } : r.baixado ? { tipo: 'sucesso', msg: 'Arquivo baixado.' } : null);
  }

  async function excluir() {
    setErro(null);
    if (confirmacao.trim().replace(/^@/, '').toLowerCase() !== perfil?.username) {
      return setErro(`Digite @${perfil?.username} para confirmar.`);
    }
    setExcluindo(true);
    const r = await excluirConta(confirmacao);
    setExcluindo(false);
    if (r.erro) setErro(r.erro);
    // Deu certo: a sessão acaba e o app volta para a tela de boas-vindas
  }

  return (
    <Tela rodape>
      <Cabecalho titulo="Minha conta" />
      <Texto suave style={{ fontSize: 15 }}>
        @{perfil?.username} · {sessao?.user?.email}
      </Texto>

      <Cartao style={{ gap: 10 }}>
        <Rotulo>Baixar meus dados</Rotulo>
        <Texto style={{ fontSize: 16 }}>
          Um arquivo com o seu perfil, registros, reviews, favoritos, amigos, grupos, comentários e posts nas comunidades.
        </Texto>
        <Botao titulo="Gerar arquivo" onPress={baixar} carregando={baixando} />
        {msgDados ? <Aviso tipo={msgDados.tipo}>{msgDados.msg}</Aviso> : null}
      </Cartao>

      <Cartao style={{ gap: 10 }}>
        <Rotulo>Excluir conta</Rotulo>
        <Texto style={{ fontSize: 16 }}>
          Apaga para sempre a sua conta e tudo o que está nela: perfil, registros, reviews, comentários, grupos que você criou, posts e
          Rewinds. Não dá para desfazer.
        </Texto>
        {abrirExclusao ? (
          <View style={{ gap: 10 }}>
            <Campo
              rotulo={`Para confirmar, digite @${perfil?.username}`}
              value={confirmacao}
              onChangeText={setConfirmacao}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Aviso>{erro}</Aviso>
            <Botao titulo="Excluir minha conta para sempre" variante="destaque" onPress={excluir} carregando={excluindo} />
            <Botao titulo="Cancelar" onPress={() => setAbrirExclusao(false)} />
          </View>
        ) : (
          <Botao titulo="Quero excluir minha conta" onPress={() => setAbrirExclusao(true)} />
        )}
      </Cartao>

      <LinksTermos />
      <Texto suave style={{ fontSize: 13 }}>Quicksave {Constants.expoConfig?.version} (beta)</Texto>
    </Tela>
  );
}
