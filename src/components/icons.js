import Svg, { Circle, Path } from 'react-native-svg';

// Ícones de traço desenhados à mão (iguais aos do mockup)
function Base({ cor, tamanho = 26, children }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

export const IconeInicio = (p) => (
  <Base {...p}><Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></Base>
);
export const IconeBuscar = (p) => (
  <Base {...p}><Circle cx="11" cy="11" r="7" /><Path d="M20 20l-4-4" /></Base>
);
export const IconeRegistrar = (p) => (
  <Base {...p}><Circle cx="12" cy="12" r="9" /><Path d="M12 8v8M8 12h8" /></Base>
);
export const IconeAmigos = (p) => (
  <Base {...p}><Circle cx="9" cy="8" r="3.5" /><Path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.2.6 3.5 2.6 3.5 6" /></Base>
);
export const IconePerfil = (p) => (
  <Base {...p}><Circle cx="12" cy="8" r="4" /><Path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></Base>
);
export const IconeVoltar = (p) => (
  <Base {...p}><Path d="M15 5l-7 7 7 7" /></Base>
);
export const IconeSino = (p) => (
  <Base {...p}><Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0" /></Base>
);
export const IconeCoracao = (p) => (
  <Base {...p}><Path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" /></Base>
);
export const IconeMarcador = (p) => (
  <Base {...p}><Path d="M7 3.5h10v17l-5-3.6-5 3.6z" /></Base>
);
export const IconeTrofeu = (p) => (
  <Base {...p}><Path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8.5 20.5h7M9.5 17h5" /></Base>
);
export const IconeComentario = (p) => (
  <Base {...p}><Path d="M4 5h16v11H9l-5 4z" /></Base>
);
export const IconeComunidades = (p) => (
  <Base {...p}><Path d="M3 5h12v8H8l-4 3.5V13H3zM15 9h6v7h-1v3l-3.5-3H11v-3" /></Base>
);
export const IconeBandeira = (p) => (
  <Base {...p}><Path d="M5 21V4M5 4h11l-2 4 2 4H5" /></Base>
);
export const IconeOlhoFechado = (p) => (
  <Base {...p}><Path d="M3 3l18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c5.5 0 9 6 9 6a16 16 0 0 1-2.9 3.6M6.5 7.6C4.3 9.2 3 12 3 12s3.5 6 9 6a8.7 8.7 0 0 0 4.1-1M9.9 10a3 3 0 0 0 4.1 4.1" /></Base>
);
export const IconeGrupo = (p) => (
  <Base {...p}><Circle cx="12" cy="7.5" r="3" /><Circle cx="5.5" cy="10" r="2.2" /><Circle cx="18.5" cy="10" r="2.2" /><Path d="M7 20c0-3 2.2-5 5-5s5 2 5 5M2 18.5c0-2 1.4-3.4 3.5-3.4M22 18.5c0-2-1.4-3.4-3.5-3.4" /></Base>
);
