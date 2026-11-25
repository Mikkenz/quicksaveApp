import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Aviso, Tela, Texto, Titulo } from '../../components/ui';
import { Cabecalho } from '../../components/Cabecalho';
import { ConteudoPerfil } from '../../components/ConteudoPerfil';
import { Denunciar } from '../../components/Denunciar';
import { Avatar, BotaoPequeno, BotaoRelacao } from '../../components/social';
import { atualizarContagens } from '../../lib/contagens';
import { bloquear, desfazerAmizade, perfilPublico } from '../../lib/social';
import { useTheme } from '../../theme';

export default function PerfilPublico() {
  const { username } = useLocalSearchParams();
  const { cores } = useTheme();
  const [perfil, setPerfil] = useState(undefined);
  const [erro, setErro] = useState(null);
  const [opcoes, setOpcoes] = useState(false);
  const [confirmar, setConfirmar] = useState(null); // 'bloquear' | 'desfazer'

  const carregar = useCallback(async () => {
    const r = await perfilPublico(String(username || ''));
    if (r.erro) setErro(r.erro);
    if (r.perfil?.relation === 'self') {
      router.replace('/perfil');
      return;
    }
    setPerfil(r.perfil);
  }, [username]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function executar(tipo) {
    if (confirmar !== tipo) {
      setConfirmar(tipo);
      return;
    }
    setErro(null);
    const r = tipo === 'bloquear' ? await bloquear(perfil.id) : await desfazerAmizade(perfil.id);
    setConfirmar(null);
    setOpcoes(false);
    if (r.erro) setErro(r.erro);
    atualizarContagens();
    carregar();
  }

  if (perfil === undefined) {
    return (
      <Tela>
        <Cabecalho titulo={`@${username}`} />
        <ActivityIndicator color={cores.link} />
      </Tela>
    );
  }

  if (!perfil) {
    return (
      <Tela>
        <Cabecalho titulo="Perfil" />
        <Texto suave>Perfil não encontrado.</Texto>
        <Aviso>{erro}</Aviso>
      </Tela>
    );
  }

  const bloqueado = perfil.relation === 'blocked';
  const nome = `@${perfil.username}`;

  return (
    <Tela>
      <Cabecalho titulo={nome} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar url={perfil.avatar_url} nome={perfil.display_name || perfil.username} tamanho={76} />
        <View style={{ flex: 1, gap: 2 }}>
          {perfil.display_name ? <Titulo nivel={2}>{perfil.display_name}</Titulo> : null}
          {perfil.bio ? <Texto suave style={{ fontSize: 15 }}>{perfil.bio}</Texto> : null}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <BotaoRelacao
          pessoa={perfil}
          relacao={perfil.relation}
          aoMudar={(nova, e) => (e ? setErro(e) : setPerfil({ ...perfil, relation: nova }))}
        />
        {bloqueado ? null : (
          <BotaoPequeno
            titulo={opcoes ? 'Fechar opções' : 'Mais opções'}
            onPress={() => {
              setOpcoes(!opcoes);
              setConfirmar(null);
            }}
          />
        )}
      </View>

      {opcoes ? (
        <View style={{ gap: 8 }}>
          {perfil.relation === 'friends' ? (
            <BotaoPequeno
              titulo={confirmar === 'desfazer' ? 'Toque de novo para desfazer a amizade' : 'Desfazer amizade'}
              onPress={() => executar('desfazer')}
            />
          ) : null}
          <BotaoPequeno
            titulo={confirmar === 'bloquear' ? `Toque de novo para bloquear ${nome}` : `Bloquear ${nome}`}
            variante="destaque"
            onPress={() => executar('bloquear')}
          />
          <Texto suave style={{ fontSize: 14 }}>
            Ao bloquear, a amizade é desfeita, a pessoa não consegue mais enviar pedidos e vocês deixam de ver os registros um do outro.
          </Texto>
          <View style={{ alignSelf: 'flex-start' }}>
            <Denunciar tipo="profile" alvo={perfil.id} descricao={`o perfil de ${nome}`} />
          </View>
        </View>
      ) : null}

      <Aviso>{erro}</Aviso>

      {bloqueado ? (
        <Texto suave>Você bloqueou {nome}. Desbloqueie para ver o perfil de novo.</Texto>
      ) : perfil.limited ? (
        <Aviso tipo="info">O perfil completo de {nome} aparece só para amigos.</Aviso>
      ) : (
        <ConteudoPerfil userId={perfil.id} />
      )}
    </Tela>
  );
}
