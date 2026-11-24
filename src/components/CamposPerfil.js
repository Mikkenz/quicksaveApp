import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Campo } from './ui';
import { supabase } from '../lib/supabase';
import { IDADE_RESPONSAVEL, MAIORIDADE, erroUsuario, idade, lerData, mascaraData, normalizarUsuario } from '../lib/validacao';
import { ALVO_TOQUE, useTheme } from '../theme';

/** Verifica no banco, com atraso de 400 ms, se o @ está livre. */
export function useUsuarioDisponivel(usuario) {
  const [estado, setEstado] = useState({ status: 'vazio' });
  useEffect(() => {
    const erro = usuario ? erroUsuario(usuario) : null;
    if (!usuario) {
      setEstado({ status: 'vazio' });
      return;
    }
    if (erro) {
      setEstado({ status: 'invalido', mensagem: erro });
      return;
    }
    setEstado({ status: 'verificando' });
    let ativo = true;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('username_available', { p_username: usuario });
      if (!ativo) return;
      if (error) {
        console.warn('username_available falhou:', error.message);
        setEstado({ status: 'desconhecido', mensagem: 'Não foi possível verificar o @ agora. Confira sua conexão e tente de novo.' });
      }
      else setEstado(data ? { status: 'livre' } : { status: 'ocupado', mensagem: `@${usuario} já está em uso.` });
    }, 400);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [usuario]);
  return estado;
}

export function CampoUsuario({ valor, onChange, estado }) {
  const { cores } = useTheme();
  const dica =
    estado.status === 'livre' ? `@${valor} está disponível` : estado.status === 'verificando' ? 'Verificando...' : '3 a 20 letras minúsculas, números ou _';
  return (
    <Campo
      rotulo="@usuário"
      value={valor}
      onChangeText={(t) => onChange(normalizarUsuario(t))}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="username"
      maxLength={20}
      erro={['invalido', 'ocupado', 'desconhecido'].includes(estado.status) ? estado.mensagem : null}
      dica={dica}
      dicaCor={estado.status === 'livre' ? cores.sucesso : undefined}
    />
  );
}

/** Data de nascimento + e-mail do responsável quando tiver menos de 12 anos. */
export function CamposIdade({ nascimento, setNascimento, responsavel, setResponsavel, erroData, erroResponsavel }) {
  const iso = lerData(nascimento);
  const anos = iso ? idade(iso) : null;
  const precisaResponsavel = anos !== null && anos < IDADE_RESPONSAVEL;
  return (
    <View style={{ gap: 16 }}>
      <Campo
        rotulo="Data de nascimento"
        placeholder="DD/MM/AAAA"
        value={nascimento}
        onChangeText={(t) => setNascimento(mascaraData(t))}
        keyboardType="number-pad"
        maxLength={10}
        erro={erroData}
        dica={
          anos !== null && anos < MAIORIDADE
            ? 'Menores de 18 anos começam com o perfil visível só para amigos.'
            : 'Não aparece no seu perfil.'
        }
      />
      {precisaResponsavel ? (
        <Campo
          rotulo="E-mail do responsável"
          value={responsavel}
          onChangeText={setResponsavel}
          autoCapitalize="none"
          keyboardType="email-address"
          erro={erroResponsavel}
          dica="Menores de 12 anos precisam da autorização de um responsável. Vamos pedir a confirmação por e-mail."
        />
      ) : null}
    </View>
  );
}

export function Caixa({ marcado, onChange, children }) {
  const { cores, borda } = useTheme();
  return (
    <Pressable
      role="checkbox"
      aria-checked={marcado}
      onPress={() => onChange(!marcado)}
      style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: ALVO_TOQUE }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderWidth: borda.largura,
          borderColor: cores.borda,
          borderRadius: 6,
          backgroundColor: marcado ? cores.primario : cores.superficie,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {marcado ? <Text style={{ color: cores.textoNoPrimario, fontWeight: '900', fontSize: 15 }}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}
