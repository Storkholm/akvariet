import './style.css';
import './ui/panel.css';
import { App } from './App';
import { Aquarium } from './aquarium/Aquarium';
import * as sounds from './audio/sounds';
import { createRng } from './util/random';

const root = document.getElementById('app');
if (!root) throw new Error('#app missing');

const aquarium = new Aquarium(root);
aquarium.start();
if (new URLSearchParams(location.search).has('still')) aquarium.setPaused(true);
const app = new App(root, aquarium);

// A child's fingers: no long-press menu, no iOS pinch-zoom gesture, no double-tap zoom.
for (const type of ['contextmenu', 'gesturestart', 'gesturechange', 'dblclick']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}

// Exposed for e2e tests / debugging only.
Object.assign(window, { aquarium, app, sounds, createRng });

// Offline support: the service worker is only emitted by the production build.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is a bonus; the game works without it */
    });
  });
}
