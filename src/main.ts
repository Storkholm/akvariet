import './style.css';
import { Aquarium } from './aquarium/Aquarium';

const app = document.getElementById('app');
if (!app) throw new Error('#app missing');

const aquarium = new Aquarium(app);
aquarium.start();

// Exposed for e2e tests / debugging only.
(window as unknown as { aquarium: Aquarium }).aquarium = aquarium;
