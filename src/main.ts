import './style.css';
import './ui/panel.css';
import { App } from './App';
import { Aquarium } from './aquarium/Aquarium';

const root = document.getElementById('app');
if (!root) throw new Error('#app missing');

const aquarium = new Aquarium(root);
aquarium.start();
if (new URLSearchParams(location.search).has('still')) aquarium.setPaused(true);
const app = new App(root, aquarium);

// Exposed for e2e tests / debugging only.
Object.assign(window, { aquarium, app });
