/**
 * PROTOTYPE (throwaway) – answers one question for M4:
 *
 *   "How big should the drawn rays be, and how crowded does the aquarium feel with up to 30 of them?"
 *
 * Branch: UI ("what should it look like / feel like"). Assumption: instead of three different layouts, the three
 * variants (A/B/C, ←/→ or ?variant=) are three creature SIZES in the REAL aquarium with the REAL swimming; sliders
 * on top fine-tune size, number and cap. Nothing in src/ is changed – sizes are applied by scaling each creature's group.
 *
 * Known simplification: the distance rays keep from each other is a constant in src/creature/swimmer.ts (7 units) and
 * does not grow with the size slider – so very large rays overlap more here than they would if the constant followed the size.
 */
import '../../src/style.css';
import * as THREE from 'three';
import { Aquarium } from '../../src/aquarium/Aquarium';
import type { Creature } from '../../src/creature/Creature';
import { rayTemplate } from '../../src/species/ray';
import { createRng } from '../../src/util/random';

const BASE_SIZE = rayTemplate.size; // 4.2 = what the game does today
const VARIANTS = {
  A: { name: 'Som nu', size: BASE_SIZE },
  B: { name: 'Mindre', size: 3.0 },
  C: { name: 'Større', size: 5.5 },
} as const;
type VariantKey = keyof typeof VARIANTS;

// ---------- state (in memory only) ----------
const root = document.getElementById('app') as HTMLElement;
const aquarium = new Aquarium(root);
aquarium.start();

let size = BASE_SIZE;
let cap = 30;
let bornCounter = 0;
const born = new Map<Creature, number>();
const leaving = new Map<Creature, { dir: number; t: number }>();

// ---------- procedural "children's drawings" ----------
const PALETTES = [
  ['#1f8f4a', '#f9d21e'], ['#e8332a', '#f7a6c8'], ['#2150c8', '#6cc4f2'], ['#8a45c6', '#f9d21e'], ['#f58a1f', '#222226'],
  ['#19bfb0', '#e8332a'], ['#f7a6c8', '#8a45c6'], ['#8fd43a', '#2150c8'], ['#222226', '#f9d21e'], ['#8a5530', '#f58a1f'],
];
const drawings: HTMLCanvasElement[] = PALETTES.map(([a, b], i) => {
  const rng = createRng(100 + i);
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = a;
  g.fillRect(0, 0, 1024, 1024);
  g.fillStyle = b;
  g.strokeStyle = b;
  const kind = i % 4;
  if (kind === 0) for (let x = 120; x < 1024; x += 150) g.fillRect(x, 0, 60, 1024);
  if (kind === 1) { g.lineWidth = 50; for (let k = -1024; k < 1024; k += 170) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 1024, 1024); g.stroke(); } }
  if (kind === 2) for (let n = 0; n < 40; n++) { g.beginPath(); g.arc(rng.range(0, 1024), rng.range(100, 700), rng.range(20, 55), 0, 7); g.fill(); }
  if (kind === 3) for (let y = 80; y < 800; y += 130) g.fillRect(0, y, 1024, 50);
  return c;
});

// ---------- creatures ----------
function alive(): Creature[] {
  return aquarium.creatures.creatures.filter((c) => !leaving.has(c));
}

function spawnOne(fromEdge: boolean): Creature {
  const b = aquarium.creatures.bounds;
  const side = Math.random() < 0.5 ? -1 : 1;
  const pos: [number, number, number] | undefined = fromEdge
    ? [side * (b.max[0] - 0.5), 4 + Math.random() * 4, -4 + Math.random() * 8]
    : undefined;
  const c = aquarium.creatures.spawn(drawings[bornCounter % drawings.length], 'ray', pos, fromEdge ? (side < 0 ? -Math.PI / 2 : Math.PI / 2) : undefined);
  c.group.scale.setScalar(size / BASE_SIZE);
  born.set(c, bornCounter++);
  return c;
}

/** CONTEXT: Afsked – the oldest creature swims out of view and is removed. */
function farewell(c: Creature): void {
  if (leaving.has(c)) return;
  c.swimmer = null; // we steer it ourselves from here on; the wing beats keep going
  leaving.set(c, { dir: c.group.position.x >= 0 ? 1 : -1, t: 0 });
}

function addOne(): void {
  const living = alive();
  if (living.length >= cap) {
    const oldest = living.reduce((a, b) => ((born.get(a) ?? 0) < (born.get(b) ?? 0) ? a : b));
    farewell(oldest);
  }
  spawnOne(true);
}

function setCount(n: number): void {
  let living = alive();
  while (living.length < n) { spawnOne(false); living = alive(); }
  while (living.length > n) {
    const newest = living.reduce((a, b) => ((born.get(a) ?? 0) > (born.get(b) ?? 0) ? a : b));
    aquarium.creatures.remove(newest);
    born.delete(newest);
    living = alive();
  }
}

function applySize(s: number): void {
  size = s;
  for (const c of aquarium.creatures.creatures) c.group.scale.setScalar(s / BASE_SIZE);
}

// ---------- farewell motion + per-frame stats (hooked after the aquarium's own update) ----------
const ndc = new THREE.Vector3();
const originalUpdate = aquarium.update.bind(aquarium);
let inView = 0;
let statTimer = 0;
aquarium.update = (dt: number): void => {
  originalUpdate(dt);
  for (const [c, f] of [...leaving]) {
    f.t += dt;
    const targetYaw = Math.atan2(-f.dir * 1, -0.35); // away sideways and a little into the picture
    let d = targetYaw - c.group.rotation.y;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    c.group.rotation.set(0.05, c.group.rotation.y + Math.max(-0.5 * dt, Math.min(0.5 * dt, d)), 0, 'YXZ');
    const speed = Math.min(3.5, 1.4 + f.t * 0.7);
    const fwd = new THREE.Vector3(0, 0, -1).applyEuler(c.group.rotation);
    c.group.position.addScaledVector(fwd, speed * dt);
    c.group.position.y += 0.15 * dt;
    ndc.copy(c.group.position).project(aquarium.camera);
    if (Math.abs(ndc.x) > 1.35 || Math.abs(ndc.y) > 1.35 || f.t > 25) {
      aquarium.creatures.remove(c);
      leaving.delete(c);
      born.delete(c);
    }
  }
  statTimer += dt;
  if (statTimer > 0.4) {
    statTimer = 0;
    aquarium.camera.updateMatrixWorld();
    inView = aquarium.creatures.creatures.filter((c) => {
      ndc.copy(c.group.position).project(aquarium.camera);
      return Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1 && ndc.z < 1;
    }).length;
  }
};

// ---------- UI: panel with sliders + floating variant bar ----------
const css = document.createElement('style');
css.textContent = `
  .proto{position:fixed;z-index:10;font:13px/1.35 system-ui,sans-serif;color:#fff;touch-action:manipulation}
  .panel{left:8px;top:8px;width:min(250px,calc(100vw - 16px));background:rgba(8,30,70,.78);border:1px solid rgba(255,255,255,.35);border-radius:12px;padding:8px 10px;backdrop-filter:blur(4px)}
  .panel summary{font-weight:700;cursor:pointer}
  .panel .q{opacity:.85;margin:6px 0}
  .panel label{display:block;margin-top:6px}
  .panel input[type=range]{width:100%}
  .panel .row{display:flex;gap:6px;margin-top:8px}
  .panel button{flex:1;min-height:40px;border-radius:9px;border:0;background:#2f86d6;color:#fff;font:inherit;font-weight:700}
  .panel button.alt{background:#ee5a4a}
  .panel .stats{margin-top:8px;font-variant-numeric:tabular-nums;background:rgba(0,0,0,.25);border-radius:8px;padding:6px 8px;display:grid;grid-template-columns:auto auto;gap:2px 10px}
  .bar{left:50%;bottom:12px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;background:#fff;color:#102040;border-radius:99px;padding:6px 8px;box-shadow:0 3px 14px rgba(0,0,0,.4);font-weight:700}
  .bar button{width:44px;height:44px;border-radius:50%;border:0;background:#102040;color:#fff;font-size:20px}
  .bar span{min-width:150px;text-align:center}
`;
document.head.append(css);

const panel = document.createElement('details');
panel.className = 'proto panel';
panel.open = window.innerWidth > 700; // on a phone it would cover a third of the picture
panel.innerHTML = `
  <summary>PROTOTYPE · størrelse &amp; trængsel</summary>
  <div class="q">Hvor store skal rokkerne være, og er 30 for mange? Prøv både liggende og stående, og tryk "Afsked".</div>
  <label>Størrelse: <b id="sizeV"></b> enheder (nu ${BASE_SIZE})<input id="size" type="range" min="2" max="7" step="0.1"></label>
  <label>Antal: <b id="countV"></b><input id="count" type="range" min="1" max="30" step="1"></label>
  <label>Loft: <b id="capV"></b><input id="cap" type="range" min="5" max="40" step="1"></label>
  <div class="row"><button id="add">Tilføj dyr</button><button id="bye" class="alt">Afsked (ældste)</button></div>
  <div class="row"><button id="pause">Pause</button></div>
  <div class="stats"><span>Dyr</span><b id="nAll"></b><span>I billedet</span><b id="nView"></b><span>FPS</span><b id="fps"></b><span>Trekanter</span><b id="tris"></b><span>Draw calls</span><b id="calls"></b></div>
`;
document.body.append(panel);
const $ = <T extends HTMLElement>(id: string): T => panel.querySelector('#' + id) as T;

const bar = document.createElement('div');
bar.className = 'proto bar';
bar.innerHTML = `<button id="prev" aria-label="Forrige">←</button><span id="vlabel"></span><button id="next" aria-label="Næste">→</button>`;
document.body.append(bar);

let variant: VariantKey = (new URLSearchParams(location.search).get('variant')?.toUpperCase() as VariantKey) in VARIANTS
  ? (new URLSearchParams(location.search).get('variant')?.toUpperCase() as VariantKey)
  : 'A';

function setVariant(k: VariantKey): void {
  variant = k;
  const url = new URL(location.href);
  url.searchParams.set('variant', k);
  history.replaceState(null, '', url);
  applySize(VARIANTS[k].size);
  sync();
}
function cycle(step: number): void {
  const keys = Object.keys(VARIANTS) as VariantKey[];
  setVariant(keys[(keys.indexOf(variant) + step + keys.length) % keys.length]);
}

function sync(): void {
  $<HTMLInputElement>('size').value = String(size);
  $('sizeV').textContent = size.toFixed(1);
  $<HTMLInputElement>('count').value = String(alive().length);
  $('countV').textContent = String(alive().length);
  $<HTMLInputElement>('cap').value = String(cap);
  $('capV').textContent = String(cap);
  (bar.querySelector('#vlabel') as HTMLElement).textContent = `${variant} (${VARIANTS[variant].name} · ${VARIANTS[variant].size.toFixed(1)})`;
}

$('size').addEventListener('input', (e) => { applySize(parseFloat((e.target as HTMLInputElement).value)); sync(); });
$('count').addEventListener('input', (e) => { setCount(parseInt((e.target as HTMLInputElement).value, 10)); sync(); });
$('cap').addEventListener('input', (e) => { cap = parseInt((e.target as HTMLInputElement).value, 10); sync(); });
$('add').addEventListener('click', () => { addOne(); sync(); });
$('bye').addEventListener('click', () => { const l = alive(); if (l.length) farewell(l.reduce((a, b) => ((born.get(a) ?? 0) < (born.get(b) ?? 0) ? a : b))); });
let paused = false;
$('pause').addEventListener('click', () => { paused = !paused; aquarium.setPaused(paused); $('pause').textContent = paused ? 'Fortsæt' : 'Pause'; });
bar.querySelector('#prev')?.addEventListener('click', () => cycle(-1));
bar.querySelector('#next')?.addEventListener('click', () => cycle(1));
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).matches?.('input,textarea,[contenteditable]')) return;
  if (e.key === 'ArrowLeft') cycle(-1);
  if (e.key === 'ArrowRight') cycle(1);
});

// live numbers
let frames = 0;
let last = performance.now();
function tick(now: number): void {
  frames++;
  if (now - last >= 500) {
    $('fps').textContent = String(Math.round((frames * 1000) / (now - last)));
    frames = 0;
    last = now;
    $('nAll').textContent = `${alive().length}${leaving.size ? ` (+${leaving.size} på vej ud)` : ''}`;
    $('nView').textContent = String(inView);
    $('tris').textContent = aquarium.renderer.info.render.triangles.toLocaleString('da-DK');
    $('calls').textContent = String(aquarium.renderer.info.render.calls);
    $<HTMLInputElement>('count').value = String(alive().length);
    $('countV').textContent = String(alive().length);
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// start: the variant's size and a full tank (30)
applySize(VARIANTS[variant].size);
setCount(30);
sync();

Object.assign(window, { aquarium, proto: { addOne, farewell, alive, setCount, applySize, setVariant } });
