import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Aviso, Botao, Campo, Tela, Texto } from '../components/ui';
import { Cabecalho } from '../components/Cabecalho';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default function EditarPerfil() {
  const { perfil, sessao, recarregarPerfil } = useAuth();
  const [nome, setNome] = useState(perfil?.display_name || '');
  const [bio, setBio] = useState(perfil?.bio || '');
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: nome.trim() || null, bio: bio.trim() || null })
      .eq('id', sessao.user.id);
    setSalvando(false);
    if (error) {
      setErro('Não foi possível salvar agora. Tente de novo.');
      return;
    }
    await recarregarPerfil();
    router.back();
  }

  return (
    <Tela rodape>
      <Cabecalho titulo="Editar perfil" />
      <Texto suave style={{ fontSize: 15 }}>O @{perfil?.username} não pode ser trocado por aqui.</Texto>
      <Campo rotulo="Nome" value={nome} onChangeText={setNome} maxLength={50} />
      <Campo rotulo="Bio" value={bio} onChangeText={setBio} maxLength={160} multiline dica={`${bio.length}/160`} />
      <Aviso>{erro}</Aviso>
      <View style={{ flex: 1 }} />
      <Botao titulo="Salvar" variante="destaque" onPress={salvar} carregando={salvando} />
    </Tela>
  );
}
