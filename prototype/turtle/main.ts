/**
 * PROTOTYPE (throwaway) – answers one question for M5:
 *
 *   "Does the existing body generator (src/body) turn a turtle template with SIX OVERLAPPING parts
 *    (shell, head, four flippers) into a body without ugly intersections where the parts meet?"
 *
 * Branch: UI ("what does it look like"). Variants (A/B/C, ←/→ or ?variant=) are three ways of building the same template:
 *   A  all parts inflated around the same plane, exactly like the ray (one buildBody call)
 *   B  each part built on its own; head and flippers moved a little DOWN, so they tuck in under the shell rim
 *   C  like B, but thinner flippers/head with a smaller thickness radius (flat paddles)
 * Views (?view=top|oblique|side|under|front, or the buttons): same body from different angles. "Net" shows the triangles.
 * Nothing in src/ is changed; the turtle template below lives only here.
 */
import * as THREE from 'three';
import { buildBody } from '../../src/body/buildBody';
import type { Vec2 } from '../../src/drawing/geometry';
import { rayTemplate } from '../../src/species/ray';
import type { Part, Template } from '../../src/species/types';

function ellipse(cx: number, cy: number, rx: number, ry: number, deg: number, n = 56): Vec2[] {
  const a = (deg * Math.PI) / 180;
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * ry;
    out.push([cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]);
  }
  return out;
}

const SHELL = { spacing: 0.03, radius: 0.22, dorsal: 0.1, ventral: 0.06 };
const LIMB = { spacing: 0.02, radius: 0.05, dorsal: 0.03, ventral: 0.025 };
const HEAD = { spacing: 0.02, radius: 0.07, dorsal: 0.05, ventral: 0.035 };

function turtle(limb = LIMB, head = HEAD): Template {
  const parts: Part[] = [
    { id: 'shell', outline: ellipse(0.5, 0.56, 0.24, 0.29, 0), body: SHELL },
    { id: 'head', outline: ellipse(0.5, 0.2, 0.07, 0.11, 0), body: head, pivot: [0.5, 0.28] },
    { id: 'flipperFL', outline: ellipse(0.22, 0.36, 0.2, 0.06, -22), body: limb, pivot: [0.36, 0.4] },
    { id: 'flipperFR', outline: ellipse(0.78, 0.36, 0.2, 0.06, 22), body: limb, pivot: [0.64, 0.4] },
    { id: 'flipperBL', outline: ellipse(0.33, 0.86, 0.11, 0.055, 38), body: limb, pivot: [0.4, 0.8] },
    { id: 'flipperBR', outline: ellipse(0.67, 0.86, 0.11, 0.055, -38), body: limb, pivot: [0.6, 0.8] },
  ];
  return { ...rayTemplate, species: 'turtle', parts, eyes: [], center: [0.5, 0.52], size: 4 };
}

// ---------- texture: green turtle with a hexagon-patterned shell, painted in template coordinates ----------
function texture(t: Template): THREE.CanvasTexture {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#5aa55a';
  g.fillRect(0, 0, S, S);
  for (const part of [...t.parts].reverse()) {
    g.beginPath();
    part.outline.forEach(([x, y], i) => (i ? g.lineTo(x * S, y * S) : g.moveTo(x * S, y * S)));
    g.closePath();
    g.fillStyle = part.id === 'shell' ? '#2f6f4f' : part.id === 'head' ? '#7cc27c' : '#8fd08f';
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(20,50,30,0.7)';
    g.stroke();
    if (part.id === 'shell') {
      g.save();
      g.clip();
      g.strokeStyle = '#a8e0a8';
      g.lineWidth = 8;
      for (let r = 0; r < 9; r++) for (let q = 0; q < 8; q++) {
        const cx = 330 + q * 52 + (r % 2) * 26 + (q - 4) * 3;
        const cy = 250 + r * 56;
        g.beginPath();
        for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3 + Math.PI / 6; g.lineTo(cx + Math.cos(a) * 29, cy + Math.sin(a) * 29); }
        g.closePath();
        g.stroke();
      }
      g.restore();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---------- the three ways of building the body ----------
type VariantKey = 'A' | 'B' | 'C';
const VARIANTS: Record<VariantKey, { name: string }> = {
  A: { name: 'Samme plan (som rokken)' },
  B: { name: 'Luffer og hoved under skjoldet' },
  C: { name: 'Tynde luffer under skjoldet' },
};

function build(variant: VariantKey): THREE.Group {
  const thin = variant === 'C';
  const t = turtle(thin ? { spacing: 0.02, radius: 0.03, dorsal: 0.016, ventral: 0.014 } : LIMB, thin ? { spacing: 0.02, radius: 0.05, dorsal: 0.03, ventral: 0.025 } : HEAD);
  const map = texture(t);
  const mat = new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide });
  const group = new THREE.Group();
  if (variant === 'A') {
    group.add(new THREE.Mesh(buildBody(t), mat)); // the generator exactly as used for the ray
  } else {
    for (const part of t.parts) {
      const mesh = new THREE.Mesh(buildBody({ ...t, parts: [part] }), mat);
      if (part.id !== 'shell') mesh.position.y = part.id === 'head' ? -0.02 * t.size : -0.032 * t.size;
      group.add(mesh);
    }
  }
  return group;
}

// ---------- scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1272b8);
scene.add(new THREE.HemisphereLight(0xcdefff, 0x2a6a8c, 1.6));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
sun.position.set(-4, 10, 6);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

const VIEWS: Record<string, { pos: [number, number, number]; name: string }> = {
  top: { pos: [0, 9.5, 0.01], name: 'Ovenfra' },
  oblique: { pos: [4.5, 4.5, 6.5], name: 'Skråt' },
  front: { pos: [0.01, 2.2, -8.5], name: 'Forfra' },
  side: { pos: [9, 0.3, 0.01], name: 'Fra siden' },
  under: { pos: [3.5, -5, 6], name: 'Nedefra' },
};
let variant = (new URLSearchParams(location.search).get('variant') ?? 'A').toUpperCase() as VariantKey;
if (!(variant in VARIANTS)) variant = 'A';
let view = new URLSearchParams(location.search).get('view') ?? 'oblique';
if (!(view in VIEWS)) view = 'oblique';
let wire = new URLSearchParams(location.search).has('net');
let current: THREE.Group | null = null;

function rebuild(): void {
  if (current) scene.remove(current);
  current = build(variant);
  current.traverse((o) => { if ((o as THREE.Mesh).isMesh) ((o as THREE.Mesh).material as THREE.MeshLambertMaterial).wireframe = wire; });
  scene.add(current);
  const [x, y, z] = VIEWS[view].pos;
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
  const url = new URL(location.href);
  url.searchParams.set('variant', variant);
  url.searchParams.set('view', view);
  if (wire) url.searchParams.set('net', ''); else url.searchParams.delete('net');
  history.replaceState(null, '', url);
  label.textContent = `${variant} (${VARIANTS[variant].name}) · ${VIEWS[view].name}${wire ? ' · net' : ''}`;
  render();
}
function render(): void {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}

// ---------- UI ----------
const style = document.createElement('style');
style.textContent = `
  .bar{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;background:#fff;color:#102040;border-radius:99px;padding:6px 8px;box-shadow:0 3px 14px rgba(0,0,0,.4);font-weight:700;max-width:calc(100vw - 16px)}
  .bar button{min-width:44px;height:44px;border-radius:22px;border:0;background:#102040;color:#fff;font:inherit;padding:0 12px}
  .bar span{min-width:120px;text-align:center;font-size:12px}
  .views{position:fixed;left:8px;top:8px;display:flex;flex-wrap:wrap;gap:6px;max-width:calc(100vw - 16px)}
  .views button{min-height:40px;border-radius:10px;border:0;background:rgba(255,255,255,.9);color:#102040;font:inherit;font-weight:700;padding:0 12px}
  .views button.on{background:#2f86d6;color:#fff}
  .q{position:fixed;right:8px;top:8px;width:min(260px,40vw);color:#fff;background:rgba(8,30,70,.7);border-radius:10px;padding:8px 10px;font-size:12px}
`;
document.head.append(style);
const bar = document.createElement('div');
bar.className = 'bar';
bar.innerHTML = '<button id="prev">←</button><span id="lab"></span><button id="next">→</button><button id="net">Net</button>';
document.body.append(bar);
const label = bar.querySelector('#lab') as HTMLElement;
const views = document.createElement('div');
views.className = 'views';
for (const [k, v] of Object.entries(VIEWS)) {
  const b = document.createElement('button');
  b.textContent = v.name;
  b.dataset.view = k;
  b.addEventListener('click', () => { view = k; markViews(); rebuild(); });
  views.append(b);
}
document.body.append(views);
const q = document.createElement('div');
q.className = 'q';
q.textContent = 'PROTOTYPE: Giver kroppen pæne samlinger, hvor skjold, hoved og luffer overlapper? Skift variant (←/→) og vinkel; "Net" viser trekanterne.';
document.body.append(q);
function markViews(): void { views.querySelectorAll('button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.view === view)); }
function cycle(step: number): void {
  const keys = Object.keys(VARIANTS) as VariantKey[];
  variant = keys[(keys.indexOf(variant) + step + keys.length) % keys.length];
  rebuild();
}
bar.querySelector('#prev')?.addEventListener('click', () => cycle(-1));
bar.querySelector('#next')?.addEventListener('click', () => cycle(1));
bar.querySelector('#net')?.addEventListener('click', () => { wire = !wire; rebuild(); });
window.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') cycle(-1); if (e.key === 'ArrowRight') cycle(1); });
window.addEventListener('resize', render);
markViews();
rebuild();
Object.assign(window, { setState: (v: VariantKey, vw: string, net = false) => { variant = v; view = vw; wire = net; markViews(); rebuild(); } });
