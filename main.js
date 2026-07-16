// main.js — game bootstrap, camera rig, turn machine, <voxel-game> element
import * as THREE from 'three';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { World } from './world.js';
import { Physics } from './physics.js';
import { Weapons, COSTS } from './weapons.js';
import { HUD } from './hud.js';
import { SFX } from './sfx.js';

const PLAYER_META = [
  { name: 'PLAYER 1', color: '#ff6b57' },
  { name: 'PLAYER 2', color: '#ffc84a' },
  { name: 'PLAYER 3', color: '#5bd0a0' },
  { name: 'PLAYER 4', color: '#6fa8ff' },
];

const GRAPHICS_SETTINGS_STORAGE_KEY = 'voxel_wreckers_graphics_settings';
const GRAPHICS_SETTINGS_STORAGE_VERSION = 2;
const GRAPHICS_SETTING_KEYS = [
  'softVoxelEdges',
  'bevelledVoxels',
  'ambientOcclusion',
  'bloom',
  'dynamicShadows',
  'gpuParticles',
];
const SAFE_GRAPHICS_DEFAULTS = {
  softVoxelEdges: false,
  bevelledVoxels: false,
  ambientOcclusion: false,
  bloom: false,
  dynamicShadows: false,
  gpuParticles: false,
};

function applyGraphicsSettings(target, source) {
  if (!source || typeof source !== 'object') return;
  for (const key of GRAPHICS_SETTING_KEYS) {
    if (typeof source[key] === 'boolean') target[key] = source[key];
  }
}

function normalizeGraphicsSettings(settings) {
  // The lightweight normal-map effect wins configuration conflicts so a stale
  // geometric-bevel preference cannot silently restore the expensive path.
  if (settings.softVoxelEdges) settings.bevelledVoxels = false;
}

// Scratch vectors to avoid allocations in tick()
const _camNormalTarget = new THREE.Vector3();
const _camNormalPos = new THREE.Vector3();
const _camDozerTarget = new THREE.Vector3();
const _camDozerPos = new THREE.Vector3();
const _camDozerFwd = new THREE.Vector3();

class Game {
  constructor(host, cfg) {
    this.host = host;
    this.cfg = cfg;
    this.players = PLAYER_META.map((m) => ({ ...m, score: 0, razed: 0 }));
    this.state = { phase: 'boot', round: 1, player: 0, spent: 0 };
    this._shake = 0;
    this._autoEnd = null;
    this.keys = {};
    this.dozerCamFactor = 0;
  }

  async loadGraphicsSettings() {
    const settings = { ...SAFE_GRAPHICS_DEFAULTS };
    try {
      const res = await fetch('./settings.json', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        applyGraphicsSettings(settings, json);
      }
    } catch (e) {
      console.warn('Failed to load settings.json:', e);
    }

    let local = null;
    try {
      local = localStorage.getItem(GRAPHICS_SETTINGS_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to read graphics settings from localStorage:', e);
    }

    if (local !== null) {
      try {
        const stored = JSON.parse(local);
        if (stored?.version === GRAPHICS_SETTINGS_STORAGE_VERSION) {
          applyGraphicsSettings(settings, stored.settings);
        } else {
          localStorage.removeItem(GRAPHICS_SETTINGS_STORAGE_KEY);
        }
      } catch (e) {
        console.warn('Failed to migrate graphics settings from localStorage:', e);
        try {
          localStorage.removeItem(GRAPHICS_SETTINGS_STORAGE_KEY);
        } catch (removeError) {
          console.warn('Failed to remove invalid graphics settings:', removeError);
        }
      }
    }
    normalizeGraphicsSettings(settings);
    this.graphicsSettings = settings;
  }

  saveGraphicsSettings() {
    normalizeGraphicsSettings(this.graphicsSettings);
    const settings = {};
    applyGraphicsSettings(settings, this.graphicsSettings);
    try {
      localStorage.setItem(GRAPHICS_SETTINGS_STORAGE_KEY, JSON.stringify({
        version: GRAPHICS_SETTINGS_STORAGE_VERSION,
        settings,
      }));
    } catch (e) {
      console.warn('Failed to save graphics settings to localStorage:', e);
    }
  }

  async init() {
    const host = this.host;
    await this.loadGraphicsSettings();

    // renderer (WebGPU with WebGL fallback)
    let renderer, canvas;
    const mkCanvas = () => {
      const c = document.createElement('canvas');
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
      host.prepend(c);
      return c;
    };
    // Detect software rasterizers (VMs, remote desktops) — drop to low-quality mode
    // so the game stays as responsive as the machine allows.
    let lowQ = false;
    try {
      const pc = document.createElement('canvas');
      const pgl = pc.getContext('webgl2') || pc.getContext('webgl');
      const ext = pgl && pgl.getExtension('WEBGL_debug_renderer_info');
      const gpu = ext ? pgl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
      lowQ = /basic render|swiftshader|llvmpipe|software/i.test(gpu);
      if (pgl) pgl.getExtension('WEBGL_lose_context')?.loseContext();
    } catch (e) { /* keep defaults */ }
    this.lowQuality = lowQ;
    try {
      canvas = mkCanvas();
      renderer = new THREE.WebGPURenderer({ canvas, antialias: !lowQ });
      await renderer.init();
    } catch (e) {
      console.warn('WebGPU unavailable, falling back to WebGL:', e);
      canvas.remove();
      canvas = mkCanvas();
      renderer = new THREE.WebGPURenderer({ canvas, antialias: !lowQ, forceWebGL: true });
      await renderer.init();
    }
    this.canvas = canvas;
    this.renderer = renderer;
    renderer.setPixelRatio(lowQ ? 1 : Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = !lowQ;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.24;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 1, 700);
    this.rig = { target: new THREE.Vector3(0, 8, 0), azIndex: 0, az: 0, elev: 0.6, dist: 150 };

    // Setup WebGPU Post-processing Bloom
    if (this.graphicsSettings.bloom && !lowQ) {
      try {
        const postProcessing = new THREE.PostProcessing(renderer);
        const scenePass = pass(this.scene, this.camera);
        const scenePassColor = scenePass.getTextureNode('output');
        const bloomPass = bloom(scenePassColor, 1.1, 0.4, 0.85);
        postProcessing.outputNode = scenePassColor.add(bloomPass);
        this.postProcessing = postProcessing;
      } catch (e) {
        console.error('Failed to initialize PostProcessing bloom:', e);
      }
    }

    this.sfx = new SFX();
    this.world = new World(this.scene, this);
    this.physics = new Physics(this.scene, this);
    this.weapons = new Weapons(this);
    this.hud = new HUD(this, host.querySelector('[data-hud]'));
    this.raycaster = new THREE.Raycaster();

    this._resize();
    const ro = new ResizeObserver(() => this._resize());
    ro.observe(host);
    this._bindInput();

    this.startMatch(true);
    let last = performance.now();
    renderer.setAnimationLoop(() => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.tick(dt);
    });
  }

  _resize() {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- input ----------
  _bindInput() {
    const c = this.canvas;
    const pointers = new Map();
    let pinchD = 0;
    const unlock = () => this.sfx.unlock();
    window.addEventListener('pointerdown', unlock, { once: false });

    const groundPt = (e) => {
      const r = c.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = -((e.clientY - r.top) / r.height) * 2 + 1;
      this.raycaster.setFromCamera({ x: nx, y: ny }, this.camera);
      const o = this.raycaster.ray.origin, d = this.raycaster.ray.direction;
      if (Math.abs(d.y) < 1e-4) return null;
      const t = -o.y / d.y;
      if (t < 0) return null;
      return new THREE.Vector3(o.x + d.x * t, 0, o.z + d.z * t);
    };

    c.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchD = Math.hypot(a.x - b.x, a.y - b.y);
      } else if (pointers.size === 1) {
        this.weapons.onGround('down', groundPt(e));
      }
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchD > 0) this.zoomCam(pinchD / Math.max(1, d));
        pinchD = d;
      } else {
        this.weapons.onGround('move', groundPt(e));
      }
    });
    const up = (e) => {
      if (pointers.size === 1) this.weapons.onGround('up', groundPt(e));
      pointers.delete(e.pointerId);
      pinchD = 0;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomCam(e.deltaY > 0 ? 1.08 : 0.92); }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      const w = this.weapons;
      const k = e.key.toLowerCase();
      if (k === 'q') this.rotateCam(1);
      if (k === 'e') this.rotateCam(-1);
      if (k === '1') this.selectWeapon('mortar');
      if (k === '2') this.selectWeapon('strike');
      if (k === '3') this.selectWeapon('dozer');
      if (this.state.phase !== 'playing') return;
      if (w.mode === 'mortar' && !w.dozer.active) {
        if (k === ' ' || k === 'enter') { w.fireMortar(); e.preventDefault(); }
      }
      if (w.dozer.active && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
  }

  rotateCam(dir) { this.rig.azIndex += dir; }
  zoomCam(f) { this.rig.dist = Math.max(78, Math.min(300, this.rig.dist * f)); }

  worldToScreen(pos) {
    const v = pos.clone().project(this.camera);
    if (v.z > 1) return null;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
  }

  shake(amt) { this._shake = Math.min(1.4, this._shake + amt); }

  // ---------- economy & scoring ----------
  spend(cost) {
    this.state.spent += cost;
    this.players[this.state.player].score -= cost;
    this.hud.refreshCash();
    this.hud.refreshScores();
    return true;
  }

  award(playerIdx, pts, pos, label, cls = 'pts') {
    const p = this.players[playerIdx];
    p.score += pts;
    this.hud.refreshScores();
    const text = label || '+' + Math.max(1, Math.round(pts));
    this.hud.popupWorld(pos, text, cls, p.color, pts);
  }

  onRazed(b, playerIdx, collapsed = false) {
    this.players[playerIdx].razed++;
    if (collapsed) {
      this.award(playerIdx, 500, b.center, `${b.label.toUpperCase()} COLLAPSED +500`, 'big');
    } else {
      this.award(playerIdx, 500, b.center, `${b.label.toUpperCase()} LEVELED +500`, 'big');
    }
    this.sfx.chime(true);
    this.shake(0.4);
  }

  onCollapse() { /* impact sound handled by physics on landing */ }

  explode(at, radius, playerIdx, power = 1) {
    this.sfx.boom(power);
    this.shake(0.35 + 0.3 * power);
    this.physics.shockwave(at, radius);
    this.physics.spawnDust(at, Math.round(12 * power) + 6, { spread: radius * 0.7, up: 6 * power, out: 5 * power, scale: 1.2 * power });
    if (at.y < 2.2) this.physics.addCrater(at, radius);
    this.world.destroySphere(this, playerIdx, at, radius);
  }

  // ---------- turn machine ----------
  startMatch(first = false) {
    for (const p of this.players) { p.score = 0; p.razed = 0; }
    this.state.round = 1;
    this.state.player = 0;
    this.physics.reset();
    this.weapons.removeDozer();
    this.dozerCamFactor = 0;
    this.world.buildMap(Math.floor(Math.random() * 5));
    this.state.phase = 'title';
    this.hud.refreshTurn();
    this.hud.showTitle(this.world.mapName, () => this.startTurn());
  }

  startTurn() {
    this.state.spent = 0;
    this.state.phase = 'intro';
    this._autoEnd = null;
    this.weapons.removeDozer();
    this.dozerCamFactor = 0;
    this.weapons.setMode('none');
    this.hud.setWeapon('none');
    this.hud.refreshTurn();
    this.hud.showTurnIntro(() => {
      this.state.phase = 'playing';
      this.selectWeapon('mortar');
    });
  }

  selectWeapon(m) {
    if (this.state.phase !== 'playing') return;
    if (this.weapons.setMode(m)) this.hud.setWeapon(m);
  }

  endTurnRequest() {
    if (this.state.phase !== 'playing' || this.weapons.busy) return;
    this.endTurn();
  }

  endTurn() {
    this.state.phase = 'between';
    this.weapons.removeDozer();
    this.weapons.setMode('none');
    this.hud.setWeapon('none');
    this.state.player++;
    if (this.state.player >= 4) {
      this.state.player = 0;
      if (this.state.round >= this.cfg.rounds) {
        this.sfx.fanfare();
        this.hud.showPodium(() => this.startMatch());
      } else {
        this.hud.showRecap(() => { this.state.round++; this.startTurn(); });
      }
    } else {
      this.startTurn();
    }
  }

  // ---------- frame ----------
  tick(dt) {
    // dozer input: joystick wins, else keys
    const dz = this.weapons.dozer;
    if (dz.active) {
      if (this.hud.joy.active) {
        dz.input.f = this.hud.joy.f;
        dz.input.s = this.hud.joy.s;
      } else {
        const K = this.keys;
        dz.input.f = (K['w'] || K['arrowup'] ? 1 : 0) + (K['s'] || K['arrowdown'] ? -1 : 0);
        dz.input.s = (K['d'] || K['arrowright'] ? 1 : 0) + (K['a'] || K['arrowleft'] ? -1 : 0);
      }
    }

    this.weapons.update(dt);
    this.physics.update(dt, this.world);
    this.world.update(dt, this);
    this.hud.update(dt);

    // camera
    const r = this.rig;
    const targetAz = r.azIndex * (Math.PI / 2);
    r.az += (targetAz - r.az) * Math.min(1, dt * 6);
    this._shake *= Math.exp(-dt * 3.2);
    const sh = this._shake;
    const ox = (Math.random() - 0.5) * sh;
    const oy = (Math.random() - 0.5) * sh;
    const oz = (Math.random() - 0.5) * sh;

    // Update dozer camera factor
    if (dz.active) {
      this.dozerCamFactor = Math.min(1, this.dozerCamFactor + dt * 4.0); // 0.25 second transition
    } else {
      this.dozerCamFactor = Math.max(0, this.dozerCamFactor - dt * 4.0);
    }

    const ce = Math.cos(r.elev), se = Math.sin(r.elev);
    _camNormalPos.set(
      r.target.x + Math.sin(r.az) * ce * r.dist,
      r.target.y + se * r.dist,
      r.target.z + Math.cos(r.az) * ce * r.dist
    );
    _camNormalTarget.copy(r.target);

    if (this.dozerCamFactor > 0) {
      const zoomScale = r.dist / 150;
      const dozerDist = 38 * zoomScale;
      const dozerHeight = 16 * zoomScale;

      _camDozerFwd.set(-Math.sin(dz.yaw), 0, -Math.cos(dz.yaw));
      _camDozerPos.copy(dz.pos)
        .addScaledVector(_camDozerFwd, -dozerDist)
        .add(new THREE.Vector3(0, dozerHeight, 0));
      _camDozerTarget.copy(dz.pos).add(new THREE.Vector3(0, 3.5, 0));

      _camNormalPos.lerp(_camDozerPos, this.dozerCamFactor);
      _camNormalTarget.lerp(_camDozerTarget, this.dozerCamFactor);
    }

    this.camera.position.set(_camNormalPos.x + ox, _camNormalPos.y + oy, _camNormalPos.z + oz);
    this.camera.lookAt(_camNormalTarget.x + ox * 0.5, _camNormalTarget.y + oy * 0.5, _camNormalTarget.z + oz * 0.5);
    if (this.postProcessing) {
      this.postProcessing.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

// ---------- custom element ----------
class VoxelGameEl extends HTMLElement {
  constructor() {
    super();
    this._cfg = { cashPerRound: 2000, rounds: 3, debrisAmount: 1, collapseThreshold: 0.5, explosiveness: 1 };
  }
  connectedCallback() {
    if (this._booted) return;
    this._booted = true;
    this.style.cssText += ';position:absolute;inset:0;display:block;overflow:hidden;background:#2a1840;';
    // attribute overrides
    const num = (names, key) => {
      for (const n of names) {
        const v = this.getAttribute(n);
        if (v != null && !isNaN(+v)) this._cfg[key] = +v;
      }
    };
    num(['cash-per-round', 'cashperround'], 'cashPerRound');
    num(['rounds'], 'rounds');
    num(['debris-amount', 'debrisamount'], 'debrisAmount');
    num(['collapse-threshold', 'collapsethreshold'], 'collapseThreshold');
    num(['explosiveness'], 'explosiveness');
    this.innerHTML = `
      <div data-loading style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
        color:#ffb36b;font-family:Bungee,Rubik,sans-serif;font-size:20px;letter-spacing:.08em;z-index:20">LOADING&hellip;</div>
      <div data-hud style="position:absolute;inset:0;pointer-events:none;z-index:5"></div>`;
    this._start();
  }
  async _start() {
    try {
      const game = new Game(this, this._cfg);
      this._game = game;
      await game.init();
      this.querySelector('[data-loading]')?.remove();
    } catch (e) {
      console.error('VoxelGame boot failed:', e);
      const l = this.querySelector('[data-loading]');
      if (l) l.textContent = '3D failed to load \u2014 check console';
    }
  }
}
['cashPerRound', 'rounds', 'debrisAmount', 'collapseThreshold', 'explosiveness'].forEach((k) => {
  Object.defineProperty(VoxelGameEl.prototype, k, {
    set(v) { if (v != null && !isNaN(+v)) this._cfg[k] = +v; },
    get() { return this._cfg[k]; },
  });
});
if (!customElements.get('voxel-game')) customElements.define('voxel-game', VoxelGameEl);
