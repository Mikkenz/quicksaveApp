import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Aviso, Botao, Campo, Tela, Texto } from '../../components/ui';
import { Cabecalho } from '../../components/Cabecalho';
import { criarGrupo, editarGrupo, meusGrupos } from '../../lib/social';

// Criar grupo (sem parâmetro) ou editar nome e descrição (?id=...)
export default function NovoGrupo() {
  const { id } = useLocalSearchParams();
  const editando = Boolean(id);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!editando) return;
    meusGrupos().then((gs) => {
      const g = gs.find((x) => x.id === id);
      if (g) {
        setNome(g.name);
        setDescricao(g.description || '');
      }
    });
  }, [editando, id]);

  async function salvar() {
    setErro(null);
    if (nome.trim().length < 2) {
      setErro('O nome precisa ter pelo menos 2 letras.');
      return;
    }
    setSalvando(true);
    const r = editando ? await editarGrupo(id, nome.trim(), descricao.trim()) : await criarGrupo(nome.trim(), descricao.trim());
    setSalvando(false);
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    if (editando) router.back();
    else router.replace(`/grupo/${r.dados}`);
  }

  return (
    <Tela>
      <Cabecalho titulo={editando ? 'Editar grupo' : 'Novo grupo'} />
      {editando ? null : (
        <Texto suave style={{ fontSize: 15 }}>
          Grupos são privados: só entra quem você convidar, e só dá para convidar amigos. Até 20 pessoas.
        </Texto>
      )}
      <Campo rotulo="Nome do grupo" value={nome} onChangeText={setNome} maxLength={40} dica={`${nome.length}/40`} />
      <Campo rotulo="Descrição (opcional)" value={descricao} onChangeText={setDescricao} maxLength={280} multiline dica={`${descricao.length}/280`} />
      <Aviso>{erro}</Aviso>
      <View style={{ flex: 1 }} />
      <Botao titulo={editando ? 'Salvar' : 'Criar grupo'} variante="destaque" onPress={salvar} carregando={salvando} />
    </Tela>
  );
}
