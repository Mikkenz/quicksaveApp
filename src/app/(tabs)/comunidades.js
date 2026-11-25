import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Aviso, Rotulo, Tela, Texto } from '../../components/ui';
import { CabecalhoAba } from '../../components/Cabecalho';
import { CampoBusca } from '../../components/busca';
import { BotaoPequeno } from '../../components/social';
import { CartaoTopico, LinhaComunidade } from '../../components/comunidades';
import { useAuth } from '../../lib/auth';
import { AvisoResponsavel } from '../../components/AvisoConta';
import { buscarComunidades, buscarTopicos, comunidadesEmAlta, minhasComunidades } from '../../lib/comunidades';
import { useTheme } from '../../theme';

// Busca comunidades e tópicos ao mesmo tempo
function Busca({ texto }) {
  const { cores } = useTheme();
  const [comunidades, setComunidades] = useState([]);
  const [posts, setPosts] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const ultima = useRef(0);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) {
      setComunidades([]);
      setPosts([]);
      return;
    }
    setBuscando(true);
    const meu = ++ultima.current;
    const t = setTimeout(async () => {
      const [c, p] = await Promise.all([buscarComunidades(q), buscarTopicos(q)]);
      if (meu !== ultima.current) return;
      setComunidades(c);
      setPosts(p);
      setBuscando(false);
    }, 350);
    return () => clearTimeout(t);
  }, [texto]);

  return (
    <View style={{ gap: 16 }}>
      {buscando ? <ActivityIndicator color={cores.link} /> : null}
      <View style={{ gap: 2 }}>
        <Rotulo>Comunidades</Rotulo>
        {!buscando && comunidades.length === 0 ? <Texto suave style={{ fontSize: 15 }}>Nenhuma comunidade encontrada.</Texto> : null}
        {comunidades.map((c) => <LinhaComunidade key={c.id} c={c} detalhe={c.is_member ? 'você participa' : null} />)}
      </View>
      <View style={{ gap: 12 }}>
        <Rotulo>Tópicos</Rotulo>
        {!buscando && posts.length === 0 ? <Texto suave style={{ fontSize: 15 }}>Nenhum tópico encontrado.</Texto> : null}
        {posts.map((p) => <CartaoTopico key={p.id} t={p} />)}
      </View>
    </View>
  );
}

export default function Comunidades() {
  const { menorDeIdade, precisaAutorizacao } = useAuth();
  const [busca, setBusca] = useState('');
  const [minhas, setMinhas] = useState([]);
  const [alta, setAlta] = useState([]);
  const [carregou, setCarregou] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (precisaAutorizacao) return;
      Promise.all([minhasComunidades(), comunidadesEmAlta()]).then(([m, a]) => {
        setMinhas(m);
        setAlta(a);
        setCarregou(true);
      });
    }, [precisaAutorizacao])
  );

  if (precisaAutorizacao) {
    return (
      <Tela>
        <CabecalhoAba titulo="Comunidades" />
        <AvisoResponsavel texto="Para ver as comunidades, seu responsável precisa autorizar. Enquanto isso, você pode usar o seu diário normalmente." />
      </Tela>
    );
  }

  return (
    <Tela>
      <CabecalhoAba
        titulo="Comunidades"
        direita={menorDeIdade ? null : <BotaoPequeno titulo="Criar" variante="primario" accessibilityLabel="Criar comunidade" onPress={() => router.push('/comunidade/nova')} />}
      >
        <CampoBusca valor={busca} onChange={setBusca} placeholder="Buscar comunidades e tópicos" />
      </CabecalhoAba>

      {menorDeIdade ? (
        <Aviso tipo="info">Você pode ler e participar das comunidades. Postar e responder fica liberado a partir dos 18 anos.</Aviso>
      ) : null}

      {busca.trim().length >= 2 ? (
        <Busca texto={busca} />
      ) : (
        <>
          <View style={{ gap: 2 }}>
            <Rotulo>Suas comunidades</Rotulo>
            {carregou && minhas.length === 0 ? (
              <Texto suave style={{ fontSize: 15 }}>Você ainda não participa de nenhuma. Veja as que estão em alta ou busque um tema.</Texto>
            ) : null}
            {minhas.map((c) => (
              <LinhaComunidade key={c.id} c={c} detalhe={c.my_role === 'owner' ? 'você criou' : c.my_role === 'mod' ? 'você modera' : null} />
            ))}
          </View>

          <View style={{ gap: 2 }}>
            <Rotulo>Em alta</Rotulo>
            {carregou && alta.length === 0 ? <Texto suave style={{ fontSize: 15 }}>Ainda não há comunidades. Crie a primeira!</Texto> : null}
            {alta.map((c) => (
              <LinhaComunidade
                key={c.id}
                c={c}
                detalhe={[c.activity ? `${c.activity} ${c.activity === 1 ? 'post' : 'posts'} na semana` : null, c.is_member ? 'você participa' : null].filter(Boolean).join(' · ')}
              />
            ))}
          </View>
        </>
      )}
    </Tela>
  );
}
