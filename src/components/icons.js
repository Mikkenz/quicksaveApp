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
