import { View } from 'react-native';
import { LinkTexto } from './ui';
import { URL_PRIVACIDADE, URL_TERMOS, abrirPagina } from '../lib/termos';

/** Links para os termos de uso e a política de privacidade do app. */
export function LinksTermos({ centralizado }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, justifyContent: centralizado ? 'center' : 'flex-start' }}>
      <LinkTexto titulo="Termos de uso" onPress={() => abrirPagina(URL_TERMOS)} />
      <LinkTexto titulo="Política de privacidade" onPress={() => abrirPagina(URL_PRIVACIDADE)} />
    </View>
  );
}
