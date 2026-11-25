import { Text, View } from 'react-native';
import { Capa } from '../jogos';
import { Aviso, Botao } from '../ui';
import { CartaoRewind } from './Compartilhar';
import { CORES_STORIES } from './Stories';
import { MESES, MESES_CURTOS, nomeDoPeriodo, numero, perfilDeJogador } from '../../lib/rewind';
import { fonts } from '../../theme';

// Peças de texto das telas (as cores vêm de cada tela)
const Rotulo = ({ cor, children }) => (
  <Text style={{ fontFamily: fonts.monoMedia, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: cor }}>{children}</Text>
);
const Grande = ({ cor, children, tamanho = 44 }) => (
  <Text style={{ fontFamily: fonts.display, fontSize: tamanho, lineHeight: tamanho * 1.05, color: cor }}>{children}</Text>
);
const Corpo = ({ cor, children }) => (
  <Text style={{ fontFamily: fonts.corpo, fontSize: 18, lineHeight: 26, color: cor }}>{children}</Text>
);

function BlocoNumero({ valor, rotulo, cor }) {
  return (
    <View style={{ width: '50%', paddingVertical: 14 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 56, lineHeight: 58, color: cor }}>{numero(valor)}</Text>
      <Text style={{ fontFamily: fonts.monoMedia, fontSize: 13, letterSpacing: 1.6, textTransform: 'uppercase', color: cor }}>{rotulo}</Text>
    </View>
  );
}

/**
 * Monta as telas do Rewind a partir dos dados salvos.
 * extras: { compartilhar, podeCompartilhar } vindos da tela.
 */
export function montarTelas(rewind, extras) {
  const d = rewind.data || {};
  const anual = rewind.kind === 'year';
  const nome = nomeDoPeriodo(rewind);
  const perfil = perfilDeJogador(d, rewind.kind);
  const pouco = (d.jogos || 0) < 3;
  const telas = [];
  const add = (id, corNome, rotulo, conteudo, interativa) => telas.push({ id, ...CORES_STORIES[corNome], rotulo, conteudo, interativa });

  // 1. Abertura
  add('abertura', 'roxo', `Rewind ${nome}. Seu ${anual ? 'ano' : 'mês'} no Quicksave, @${rewind.username}.`, (
    <View style={{ gap: 12 }}>
      <Rotulo cor={CORES_STORIES.roxo.cor}>Quicksave Rewind</Rotulo>
      <Grande cor={CORES_STORIES.roxo.cor} tamanho={58}>{anual ? `Seu ${nome}` : `Seu ${nome}`}</Grande>
      <Corpo cor={CORES_STORIES.roxo.cor}>
        {anual ? 'Um ano inteiro de jogos, notas e reviews.' : `O que você jogou em ${nome}.`} Bora ver, @{rewind.username}?
      </Corpo>
    </View>
  ));

  // 2. Números
  const cN = CORES_STORIES.creme.cor;
  add(
    'numeros',
    'creme',
    `${d.jogos} jogos, ${d.zerados} zerados, ${d.horas} horas e ${d.reviews} reviews.`,
    <View style={{ gap: 8 }}>
      <Rotulo cor={cN}>{pouco ? `Seu ${nome} foi tranquilo por aqui` : 'Em números'}</Rotulo>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <BlocoNumero valor={d.jogos} rotulo="Jogos" cor={cN} />
        <BlocoNumero valor={d.zerados} rotulo="Zerados" cor={cN} />
        <BlocoNumero valor={d.horas} rotulo="Horas" cor={cN} />
        <BlocoNumero valor={d.reviews} rotulo="Reviews" cor={cN} />
      </View>
      {d.largados ? <Corpo cor={cN}>E {d.largados} {d.largados === 1 ? 'ficou' : 'ficaram'} pelo caminho. Acontece.</Corpo> : null}
      {pouco ? <Corpo cor={cN}>Registre mais jogos e o próximo Rewind fica bem mais recheado.</Corpo> : null}
    </View>
  );

  // 3. Maior nota e top 5
  const top = d.top || [];
  if (top.length) {
    const cV = CORES_STORIES.vermelho.cor;
    const [primeiro, ...resto] = top;
    add(
      'top',
      'vermelho',
      `Sua maior nota: ${primeiro.name}, nota ${primeiro.rating}. ${resto.map((j, i) => `${i + 2}º ${j.name}`).join(', ')}`,
      <View style={{ gap: 16 }}>
        <Rotulo cor={cV}>Sua maior nota</Rotulo>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <Capa imageId={primeiro.cover} nome={primeiro.name} largura={110} />
          <View style={{ flex: 1, gap: 6 }}>
            <Grande cor={cV} tamanho={28}>{primeiro.name}</Grande>
            <Text style={{ fontFamily: fonts.monoMedia, fontSize: 18, color: cV }}>Nota {primeiro.rating}</Text>
          </View>
        </View>
        {resto.length ? (
          <View style={{ gap: 6 }}>
            {resto.map((j, i) => (
              <Text key={j.id} style={{ fontFamily: fonts.displayMedia, fontSize: 18, color: cV }} numberOfLines={1}>
                {i + 2}. {j.name} · {j.rating}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  // 4. Gosto
  if (d.genero_favorito || d.plataforma_favorita) {
    const cL = CORES_STORIES.lilas.cor;
    add(
      'gosto',
      'lilas',
      `Gênero favorito: ${d.genero_favorito || 'nenhum'}. Plataforma: ${d.plataforma_favorita || 'não informada'}.`,
      <View style={{ gap: 18 }}>
        {d.genero_favorito ? (
          <View style={{ gap: 4 }}>
            <Rotulo cor={cL}>Gênero favorito</Rotulo>
            <Grande cor={cL}>{d.genero_favorito}</Grande>
            {d.generos_distintos > 1 ? <Corpo cor={cL}>Entre {d.generos_distintos} gêneros diferentes.</Corpo> : null}
          </View>
        ) : null}
        {d.plataforma_favorita ? (
          <View style={{ gap: 4 }}>
            <Rotulo cor={cL}>Onde você mais jogou</Rotulo>
            <Grande cor={cL}>{d.plataforma_favorita}</Grande>
          </View>
        ) : null}
      </View>
    );
  }

  // 5. Meses (só no anual)
  if (anual && Array.isArray(d.meses) && d.meses.some((n) => n > 0)) {
    const cT = CORES_STORIES.tinta.cor;
    const maior = Math.max(...d.meses);
    const mesTop = d.meses.indexOf(maior);
    add(
      'meses',
      'tinta',
      `Seu mês mais ativo foi ${MESES[mesTop]}, com ${maior} jogos.`,
      <View style={{ gap: 16 }}>
        <Rotulo cor={cT}>Mês mais ativo</Rotulo>
        <Grande cor={cT}>{MESES[mesTop]}</Grande>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 170 }}>
          {d.meses.map((n, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View
                style={{
                  width: '100%',
                  height: Math.max(4, (n / (maior || 1)) * 140),
                  backgroundColor: i === mesTop ? '#c21808' : '#b79cce',
                  borderWidth: 2,
                  borderColor: cT,
                  borderRadius: 4,
                }}
              />
              <Text style={{ fontFamily: fonts.monoMedia, fontSize: 11, color: cT }}>{MESES_CURTOS[i]}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // 6. Reviews
  if (d.reviews > 0) {
    const cC = CORES_STORIES.creme.cor;
    const rv = d.review_mais_curtida;
    add(
      'reviews',
      'creme',
      `${d.reviews} reviews escritas.${rv ? ` A mais curtida foi sobre ${rv.name}, com ${rv.curtidas} curtidas.` : ''}`,
      <View style={{ gap: 14 }}>
        <Rotulo cor={cC}>Reviews</Rotulo>
        <Grande cor={cC}>{d.reviews} {d.reviews === 1 ? 'review' : 'reviews'}</Grande>
        {rv ? (
          <View style={{ gap: 6, borderWidth: 3, borderColor: cC, borderRadius: 14, padding: 14 }}>
            <Text style={{ fontFamily: fonts.monoMedia, fontSize: 12, letterSpacing: 1.2, color: cC }}>
              A MAIS CURTIDA · {rv.curtidas} {rv.curtidas === 1 ? 'CURTIDA' : 'CURTIDAS'}
            </Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: cC }}>{rv.name}</Text>
            <Text style={{ fontFamily: fonts.corpoItalico, fontSize: 17, lineHeight: 24, color: cC }} numberOfLines={5}>
              {rv.spoiler ? 'Esta review tem spoiler, então fica escondida aqui.' : `“${rv.trecho}${rv.trecho?.length >= 160 ? '...' : ''}”`}
            </Text>
          </View>
        ) : (
          <Corpo cor={cC}>Continue escrevendo: o pessoal lê.</Corpo>
        )}
      </View>
    );
  }

  // 7. Social
  const social = (d.reacoes_recebidas || 0) + (d.comentarios_recebidos || 0) + (d.novos_amigos || 0) + (d.topicos || 0) + (d.respostas || 0) + (d.curtidas_reviews || 0);
  if (social > 0) {
    const cR = CORES_STORIES.roxo.cor;
    const linhas = [
      d.novos_amigos ? `${d.novos_amigos} ${d.novos_amigos === 1 ? 'amigo novo' : 'amigos novos'}` : null,
      d.reacoes_recebidas ? `${d.reacoes_recebidas} reações recebidas` : null,
      d.comentarios_recebidos ? `${d.comentarios_recebidos} comentários recebidos` : null,
      d.curtidas_reviews ? `${d.curtidas_reviews} curtidas nas suas reviews` : null,
      d.topicos ? `${d.topicos} ${d.topicos === 1 ? 'tópico criado' : 'tópicos criados'} nas comunidades` : null,
      d.respostas ? `${d.respostas} respostas nas comunidades` : null,
    ].filter(Boolean);
    add(
      'social',
      'roxo',
      linhas.join('. '),
      <View style={{ gap: 14 }}>
        <Rotulo cor={cR}>Você e a galera</Rotulo>
        {linhas.map((l) => (
          <Text key={l} style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 28, color: cR }}>{l}</Text>
        ))}
      </View>
    );
  }

  // 8. Comparação (só com gente suficiente para o número fazer sentido)
  if ((d.total_jogadores || 0) >= 5 && d.zerados > 0 && d.percentil_zerados > 0) {
    const cV = CORES_STORIES.vermelho.cor;
    add(
      'comparacao',
      'vermelho',
      `Você zerou mais jogos que ${d.percentil_zerados}% dos jogadores do Quicksave.`,
      <View style={{ gap: 10 }}>
        <Rotulo cor={cV}>Comparando</Rotulo>
        <Grande cor={cV} tamanho={96}>{d.percentil_zerados}%</Grande>
        <Corpo cor={cV}>Você zerou mais jogos que {d.percentil_zerados}% dos jogadores do Quicksave {anual ? 'neste ano' : 'neste mês'}.</Corpo>
      </View>
    );
  }

  // 9. Perfil de jogador
  const cT = CORES_STORIES.tinta.cor;
  add(
    'perfil',
    'tinta',
    `Seu perfil de jogador: ${perfil.titulo}. ${perfil.descricao}`,
    <View style={{ gap: 14 }}>
      <Rotulo cor={cT}>Seu perfil de jogador</Rotulo>
      <View style={{ alignSelf: 'flex-start', backgroundColor: '#c21808', borderWidth: 3, borderColor: cT, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 12, transform: [{ rotate: '-3deg' }] }}>
        <Grande cor="#ffeecc" tamanho={46}>{perfil.titulo}</Grande>
      </View>
      <Corpo cor={cT}>{perfil.descricao}</Corpo>
    </View>
  );

  // 10. Final com o cartão para compartilhar
  const cF = CORES_STORIES.creme.cor;
  add(
    'final',
    'creme',
    'Resumo do Rewind com o botão de compartilhar.',
    <View style={{ alignItems: 'center', gap: 14 }}>
      <View style={{ transform: [{ scale: 0.82 }], marginVertical: -45 }}>
        <CartaoRewind ref={extras.ref} rewind={rewind} semCapa={extras.semCapa} />
      </View>
      {extras.podeCompartilhar ? (
        <Botao titulo="Compartilhar imagem" variante="destaque" onPress={extras.compartilhar} carregando={extras.enviando} style={{ alignSelf: 'stretch' }} />
      ) : (
        <Text style={{ fontFamily: fonts.corpo, fontSize: 15, color: cF, textAlign: 'center' }}>
          Compartilhar fica liberado quando seu responsável autorizar.
        </Text>
      )}
      <Aviso tipo="sucesso">{extras.mensagem}</Aviso>
      <Aviso>{extras.erro}</Aviso>
    </View>,
    true
  );

  return telas;
}
