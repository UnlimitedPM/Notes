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
    const height = vv ? vv.height : window.innerHeight;
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

trackViewportHeight();

const target = document.getElementById('app');
if (!target) throw new Error('Élément #app introuvable');

const app = mount(App, { target });

export default app;
