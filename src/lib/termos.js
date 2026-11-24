import * as WebBrowser from 'expo-web-browser';

// Ao mudar algo importante nos termos ou na privacidade (páginas no site),
// troque esta versão: o app vai pedir um novo aceite a todo mundo.
export const VERSAO_TERMOS = '2026-11-25';

export const URL_TERMOS = 'https://quicksavegames.com.br/app/termos';
export const URL_PRIVACIDADE = 'https://quicksavegames.com.br/app/privacidade';

/** Abre a página dentro do app (Android) ou numa aba nova (web). */
export function abrirPagina(url) {
  return WebBrowser.openBrowserAsync(url);
}
