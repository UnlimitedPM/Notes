import './app.css';
import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';

registerSW({ immediate: true });

/**
 * Hauteur réellement visible (clavier ouvert compris).
 * `100dvh` ne change pas quand le clavier s'ouvre : la barre d'outils de la note
 * se retrouvait cachée derrière le clavier. On suit donc le visualViewport.
 */
function trackViewportHeight() {
  const vv = window.visualViewport;
  const apply = () => {
    const layout = Math.max(window.innerHeight, document.documentElement.clientHeight);
    const visual = vv ? vv.height : layout;
    // Paysage (même sur un téléphone couché) : on suit le viewport visuel, sinon
    // la barre de navigation passe sous l'écran.
    // Clavier ouvert en portrait : le viewport visuel devient nettement plus petit.
    // Sinon on garde la hauteur de mise en page (évite une bande vide en bas).
    const landscape = window.innerWidth > window.innerHeight;
    const height = landscape || visual < layout - 120 ? visual : layout;
    document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
  };
  apply();
  if (!vv) {
    window.addEventListener('resize', apply);
    return;
  }
  vv.addEventListener('resize', apply);
  vv.addEventListener('scroll', apply);
}

/**
 * L'app ne se tient qu'en vertical : on verrouille l'orientation quand le
 * navigateur l'autorise (PWA installée, plein écran). Ignoré sinon.
 */
async function lockPortrait() {
  try {
    const orientation = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
    await orientation?.lock?.('portrait');
  } catch {
    // pas de verrou possible dans un onglet : le manifeste s'en occupe à l'installation
  }
}

trackViewportHeight();

const target = document.getElementById('app');
if (!target) throw new Error('Élément #app introuvable');

const app = mount(App, { target });

void lockPortrait();

export default app;
