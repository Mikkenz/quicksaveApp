import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Aviso, Tela, Texto } from '../../components/ui';
import { CabecalhoAba } from '../../components/Cabecalho';
import { CampoBusca, LinhaJogo, useBuscaJogos } from '../../components/busca';
import { CreditoIGDB } from '../../components/jogos';
import { useTheme } from '../../theme';

export default function Buscar() {
  const { cores } = useTheme();
  const [texto, setTexto] = useState('');
  const { itens, carregando, erro } = useBuscaJogos(texto);
  const q = texto.trim();

  return (
    <Tela>
      <CabecalhoAba titulo="Buscar">
        <CampoBusca valor={texto} onChange={setTexto} />
      </CabecalhoAba>
      {carregando ? <ActivityIndicator color={cores.primario} style={{ marginTop: 12 }} accessibilityLabel="Buscando" /> : null}
      <Aviso>{erro}</Aviso>
      {!carregando && !erro && q.length >= 2 && itens.length === 0 ? (
        <Texto suave>Nenhum jogo encontrado para “{q}”. Tente o nome em inglês.</Texto>
      ) : null}
      {q.length < 2 ? <Texto suave>Digite o nome de um jogo para buscar. A busca de pessoas chega na próxima fase.</Texto> : null}
      <View>
        {itens.map((j) => (
          <LinhaJogo key={j.igdb_id} jogo={j} />
        ))}
      </View>
      <CreditoIGDB />
    </Tela>
  );
}
