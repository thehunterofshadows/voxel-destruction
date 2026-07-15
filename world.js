// world.js — voxel buildings, maps, ground, sky, lighting
import * as THREE from 'three';

export const WORLD_SCALE = 3;         // buildings are built at this voxel resolution → bigger & more detailed
export const GROUND_SIZE = 96 * WORLD_SCALE;
export const MAP_LIMIT = 42 * WORLD_SCALE;

export const VOX_COLORS = {
  1: '#b65740', 2: '#96432f', 3: '#e9d6b3', 4: '#b9aa99', 5: '#948674',
  6: '#93382c', 7: '#565064', 8: '#6f4b33', 9: '#ffd98a', 10: '#8fa9c0',
  11: '#93a0ab', 12: '#6c757e', 13: '#a65e3a', 14: '#efe4cf', 15: '#4a4038',
};
const B = 1, BD = 2, PL = 3, CN = 4, CD = 5, RR = 6, RS = 7, WD = 8, GL = 9, GC = 10, MT = 11, MD = 12, RU = 13, WH = 14, DK = 15;

class VoxGrid {
  constructor(sx, sy, sz) { this.sx = sx; this.sy = sy; this.sz = sz; this.d = new Uint8Array(sx * sy * sz); }
  i(x, y, z) { return (y * this.sz + z) * this.sx + x; }
  g(x, y, z) { if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) return 0; return this.d[this.i(x, y, z)]; }
  s(x, y, z, c) { if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) return; this.d[this.i(x, y, z)] = c; }
  box(x1, y1, z1, x2, y2, z2, c) {
    for (let y = y1; y <= y2; y++) for (let z = z1; z <= z2; z++) for (let x = x1; x <= x2; x++) this.s(x, y, z, c);
  }
  shell(x1, y1, z1, x2, y2, z2, c) {
    for (let y = y1; y <= y2; y++) for (let z = z1; z <= z2; z++) for (let x = x1; x <= x2; x++) {
      if (x === x1 || x === x2 || z === z1 || z === z2) this.s(x, y, z, c);
    }
  }
  upscale(s) {
    if (s <= 1) return this;
    const n = new VoxGrid(this.sx * s, this.sy * s, this.sz * s);
    for (let y = 0; y < this.sy; y++) for (let z = 0; z < this.sz; z++) for (let x = 0; x < this.sx; x++) {
      const c = this.d[this.i(x, y, z)];
      if (!c) continue;
      for (let dy = 0; dy < s; dy++) for (let dz = 0; dz < s; dz++) for (let dx = 0; dx < s; dx++) {
        n.s(x * s + dx, y * s + dy, z * s + dz, c);
      }
    }
    return n;
  }
  // Remove fully-enclosed voxels (all 6 neighbors filled) — keeps the visible shell,
  // slashes instance count at high WORLD_SCALE so big maps stay fast.
  hollow() {
    const n = this.d.slice();
    for (let y = 0; y < this.sy; y++) for (let z = 0; z < this.sz; z++) for (let x = 0; x < this.sx; x++) {
      const i = this.i(x, y, z);
      if (!this.d[i]) continue;
      if (this.g(x + 1, y, z) && this.g(x - 1, y, z) && this.g(x, y + 1, z) && this.g(x, y - 1, z) && this.g(x, y, z + 1) && this.g(x, y, z - 1)) n[i] = 0;
    }
    this.d = n;
    return this;
  }
  rotY(t) {
    t = ((t % 4) + 4) % 4; let g = this;
    for (let k = 0; k < t; k++) {
      const n = new VoxGrid(g.sz, g.sy, g.sx);
      for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) {
        const v = g.d[g.i(x, y, z)]; if (v) n.s(g.sz - 1 - z, y, x, v);
      }
      g = n;
    }
    return g;
  }
}

// ---- Six building types ----
function genHouse() {
  const g = new VoxGrid(9, 9, 7);
  g.box(0, 0, 0, 8, 0, 6, BD);          // foundation slab
  g.shell(0, 0, 0, 8, 3, 6, B);         // brick walls
  for (const x of [2, 6]) for (const y of [1, 2]) { g.s(x, y, 6, GL); g.s(x, y, 0, GL); }
  for (const z of [2, 4]) for (const y of [1, 2]) { g.s(0, y, z, GL); g.s(8, y, z, GL); }
  g.s(4, 0, 6, WD); g.s(4, 1, 6, WD);   // door
  g.box(0, 4, 0, 8, 4, 6, WD);          // attic floor
  for (let k = 0; k <= 3; k++) g.box(0, 5 + k, k, 8, 5 + k, 6 - k, RR); // gable roof
  g.box(6, 5, 2, 6, 7, 2, BD);          // chimney
  return g;
}
function genTower() {
  const g = new VoxGrid(7, 17, 7);
  g.box(0, 0, 0, 6, 0, 6, CD);
  g.shell(0, 1, 0, 6, 13, 6, CN);
  for (let y = 2; y <= 12; y++) {
    if (y % 3 === 1) continue;
    for (const k of [1, 3, 5]) { g.s(k, y, 0, GC); g.s(k, y, 6, GC); g.s(0, y, k, GC); g.s(6, y, k, GC); }
  }
  g.box(1, 4, 1, 5, 4, 5, CD); g.box(1, 7, 1, 5, 7, 5, CD); g.box(1, 10, 1, 5, 10, 5, CD); // floor slabs
  g.box(0, 14, 0, 6, 14, 6, CD);        // roof slab
  g.box(2, 15, 2, 4, 16, 4, CN);        // bulkhead
  return g;
}
function genWarehouse() {
  const g = new VoxGrid(13, 7, 8);
  g.box(0, 0, 0, 12, 0, 7, CD);
  g.shell(0, 1, 0, 12, 4, 7, MT);
  for (let x = 0; x <= 12; x += 2) for (let y = 1; y <= 4; y++) { if (g.g(x, y, 0)) g.s(x, y, 0, MD); if (g.g(x, y, 7)) g.s(x, y, 7, MD); }
  for (let z = 1; z <= 6; z += 2) for (let y = 1; y <= 4; y++) { g.s(0, y, z, MD); g.s(12, y, z, MD); }
  g.box(4, 1, 7, 8, 3, 7, DK);          // big door
  g.box(0, 5, 0, 12, 5, 7, MD);         // roof
  g.box(2, 5, 2, 10, 5, 2, GC); g.box(2, 5, 5, 10, 5, 5, GC); // skylights
  return g;
}
function genChapel() {
  const g = new VoxGrid(7, 15, 12);
  g.box(0, 0, 3, 6, 0, 11, CD);
  g.shell(0, 0, 3, 6, 4, 11, PL);
  for (const z of [5, 7, 9]) for (const y of [1, 2, 3]) { g.s(0, y, z, GL); g.s(6, y, z, GL); }
  g.s(3, 2, 11, GL);
  for (let k = 0; k <= 3; k++) g.box(k, 5 + k, 3, 6 - k, 5 + k, 11, RS); // nave roof
  g.box(2, 0, 0, 4, 8, 2, PL);          // bell tower
  g.s(3, 0, 0, WD); g.s(3, 1, 0, WD);   // door
  g.s(3, 6, 0, GC); g.s(3, 7, 0, GC);   // belfry window
  g.box(2, 9, 0, 4, 9, 2, RS);
  g.box(3, 10, 1, 3, 12, 1, RS);        // spire
  g.s(3, 13, 1, WH);
  return g;
}
function genWaterTower() {
  const g = new VoxGrid(7, 13, 7);
  for (const [x, z] of [[1, 1], [5, 1], [1, 5], [5, 5]]) g.box(x, 0, z, x, 4, z, MD); // legs
  g.box(1, 2, 1, 5, 2, 1, MD); g.box(1, 2, 5, 5, 2, 5, MD);
  g.box(1, 2, 1, 1, 2, 5, MD); g.box(5, 2, 1, 5, 2, 5, MD);                            // braces
  for (let y = 5; y <= 9; y++) for (let x = 0; x < 7; x++) for (let z = 0; z < 7; z++) {
    const dx = x - 3, dz = z - 3; if (dx * dx + dz * dz <= 10.9) g.s(x, y, z, y === 7 ? MT : RU);
  }
  for (let x = 0; x < 7; x++) for (let z = 0; z < 7; z++) {
    const dx = x - 3, dz = z - 3; if (dx * dx + dz * dz <= 5) g.s(x, 10, z, MD);
  }
  g.s(3, 11, 3, WH);
  return g;
}
function genFactory() {
  const g = new VoxGrid(12, 14, 7);
  g.box(0, 0, 0, 11, 0, 6, CD);
  g.shell(0, 1, 0, 11, 4, 6, CN);
  for (let x = 1; x <= 10; x += 2) for (const y of [2, 3]) { g.s(x, y, 0, GC); g.s(x, y, 6, GC); }
  g.box(1, 1, 6, 2, 3, 6, DK);          // door
  g.box(0, 5, 0, 11, 5, 6, CD);         // roof slab
  g.box(0, 6, 0, 11, 6, 1, RS); g.box(0, 6, 3, 11, 6, 4, RS); // sawtooth
  g.box(9, 1, 1, 10, 10, 2, B); g.box(9, 11, 1, 10, 12, 2, RU); // chimney
  return g;
}

export const BUILDING_TYPES = {
  house: genHouse, tower: genTower, warehouse: genWarehouse,
  chapel: genChapel, watertower: genWaterTower, factory: genFactory,
};
const TYPE_LABEL = {
  house: 'House', tower: 'Tower Block', warehouse: 'Warehouse',
  chapel: 'Chapel', watertower: 'Water Tower', factory: 'Factory',
};

// ---- Maps: same 6 building types, different placement ----
export const MAPS = [
  {
    name: 'Sunset Suburbs',
    roads: [[-46, -15, 46, -15, 5], [-46, 3, 46, 3, 5], [-46, 19, 46, 19, 5], [-2, -46, -2, 46, 4]],
    b: [
      ['house', -24, -24, 0], ['house', -10, -24, 0], ['house', 10, -24, 2], ['watertower', 24, -24, 0],
      ['warehouse', -18, -6, 0], ['tower', 12, -6, 0], ['chapel', 24, -6, 0],
      ['factory', -16, 12, 0], ['house', 6, 12, 1], ['tower', 20, 12, 0],
      ['house', -22, 26, 1], ['warehouse', 10, 26, 0], ['house', 26, 26, 0],
    ],
  },
  {
    name: 'Ring Plaza',
    roads: [[-12, -12, 12, -12, 4], [12, -12, 12, 12, 4], [-12, 12, 12, 12, 4], [-12, -12, -12, 12, 4], [12, 0, 46, 0, 4], [-46, 0, -12, 0, 4]],
    b: [
      ['chapel', 0, -2, 0],
      ['tower', 23, 0, 0], ['house', 17, 17, 1], ['warehouse', 0, 25, 0], ['factory', -17, 17, 1],
      ['tower', -23, 0, 0], ['house', -17, -17, 0], ['warehouse', 0, -25, 0], ['watertower', 17, -17, 0],
      ['house', 28, -28, 0], ['house', -28, 28, 0],
    ],
  },
  {
    name: 'Main Street',
    roads: [[-34, -34, 34, 34, 6]],
    b: [
      ['tower', -26, -13, 0], ['house', -13, -26, 0],
      ['warehouse', -16, -4, 1], ['chapel', -4, -16, 0],
      ['house', -6, 6, 0], ['factory', 6, -6, 1],
      ['watertower', 4, 16, 0], ['house', 16, 4, 0],
      ['tower', 13, 26, 0], ['warehouse', 26, 13, 1],
      ['watertower', -26, 20, 0], ['house', 26, -20, 0],
    ],
  },
  {
    name: 'Twin Districts',
    roads: [[0, -46, 0, 46, 5], [-46, -13, 46, -13, 4], [-46, 18, 46, 18, 4]],
    b: [
      ['house', -28, -20, 0], ['house', -14, -20, 0], ['chapel', -21, -2, 0],
      ['house', -28, 12, 0], ['house', -14, 12, 0], ['house', -21, 26, 1],
      ['factory', 16, -22, 0], ['warehouse', 18, -6, 0], ['watertower', 12, 8, 0],
      ['tower', 28, 8, 0], ['warehouse', 20, 24, 0],
    ],
  },
  {
    name: 'Tower Blocks',
    roads: [[-10, -46, -10, 46, 5], [10, -46, 10, 46, 5], [-46, -10, 46, -10, 5], [-46, 10, 46, 10, 5]],
    b: [
      ['tower', -20, -20, 0], ['warehouse', 0, -20, 0], ['tower', 20, -20, 0],
      ['tower', -20, 0, 0], ['watertower', 0, 0, 0], ['tower', 20, 0, 0],
      ['tower', -20, 20, 0], ['factory', 0, 20, 0], ['tower', 20, 20, 0],
      ['house', 29, 29, 0], ['house', -29, 29, 0], ['house', 29, -29, 0], ['house', -29, -29, 0],
    ],
  },
];

// ---- Building instance ----
const voxGeo = new THREE.BoxGeometry(1, 1, 1);
const voxMat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 });
const _m4 = new THREE.Matrix4();
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _tv = new THREE.Vector3();
const _tv2 = new THREE.Vector3();
const SCORCH = new THREE.Color('#22150e');

export class Building {
  constructor(scene, grid, wx, wz, type) {
    this.type = type; this.label = TYPE_LABEL[type] || type;
    this.sx = grid.sx; this.sy = grid.sy; this.sz = grid.sz;
    this.grid = grid.d.slice();
    this.origin = new THREE.Vector3(wx - this.sx / 2, 0, wz - this.sz / 2);
    this.center = new THREE.Vector3(wx, this.sy * 0.5, wz);
    let total = 0;
    for (let i = 0; i < this.grid.length; i++) if (this.grid[i]) total++;
    this.total = total; this.alive = total; this.razed = false; this.collapsed = false;
    this.ppv = 1000 / total;
    this.lastPlayer = 0; this.dirty = false;
    this.collapseAnim = null; this._lowY = 0;
    this.voxelToSlot = new Int32Array(this.grid.length).fill(-1);
    this.slotToVoxel = new Int32Array(total).fill(-1);
    const mesh = new THREE.InstancedMesh(voxGeo, voxMat, total);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    let slot = 0;
    for (let y = 0; y < this.sy; y++) for (let z = 0; z < this.sz; z++) for (let x = 0; x < this.sx; x++) {
      const vi = grid.i(x, y, z); const c = this.grid[vi]; if (!c) continue;
      _m4.makeTranslation(this.origin.x + x + 0.5, y + 0.5, this.origin.z + z + 0.5);
      mesh.setMatrixAt(slot, _m4);
      _c.set(VOX_COLORS[c]);
      const jit = 0.94 + Math.random() * 0.12;
      const ao = 0.82 + 0.18 * Math.min(1, y / 3);
      _c.multiplyScalar(jit * ao);
      mesh.setColorAt(slot, _c);
      this.voxelToSlot[vi] = slot; this.slotToVoxel[slot] = vi;
      slot++;
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.mesh = mesh;
    scene.add(mesh);
    this.aabb = new THREE.Box3(
      new THREE.Vector3(this.origin.x, 0, this.origin.z),
      new THREE.Vector3(this.origin.x + this.sx, this.sy, this.origin.z + this.sz)
    ).expandByScalar(0.6);
  }
  idx(x, y, z) { return (y * this.sz + z) * this.sx + x; }
  decode(vi) {
    const x = vi % this.sx; const r = (vi - x) / this.sx;
    const z = r % this.sz; const y = (r - z) / this.sz;
    return [x, y, z];
  }
  voxCenter(vi, out) {
    const [x, y, z] = this.decode(vi);
    return out.set(this.origin.x + x + 0.5, y + 0.5, this.origin.z + z + 0.5);
  }
  occLocal(x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) return 0;
    return this.grid[this.idx(x, y, z)];
  }
  occWorld(p) {
    const drop = this.collapseAnim ? this.collapseAnim.dropped : 0;
    const x = Math.floor(p.x - this.origin.x), y = Math.floor(p.y + drop), z = Math.floor(p.z - this.origin.z);
    return this.occLocal(x, y, z);
  }
  // Removes voxel vi; returns {pos: Vector3(new), color: Color(new)} or null
  destroyVoxel(vi) {
    const slot = this.voxelToSlot[vi];
    if (slot < 0) return null;
    const mesh = this.mesh;
    const last = mesh.count - 1;
    mesh.getColorAt(slot, _c);
    const color = _c.clone();
    const pos = this.voxCenter(vi, new THREE.Vector3());
    if (slot !== last) {
      mesh.getMatrixAt(last, _m4); mesh.setMatrixAt(slot, _m4);
      mesh.getColorAt(last, _c2); mesh.setColorAt(slot, _c2);
      const mv = this.slotToVoxel[last];
      this.slotToVoxel[slot] = mv; this.voxelToSlot[mv] = slot;
    }
    mesh.count = last;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.voxelToSlot[vi] = -1;
    this.grid[vi] = 0;
    this.alive--;
    return { pos, color };
  }
  scorchVoxel(vi, f) {
    const slot = this.voxelToSlot[vi];
    if (slot < 0) return;
    this.mesh.getColorAt(slot, _c);
    _c.lerp(SCORCH, f);
    this.mesh.setColorAt(slot, _c);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  // connected components of voxels NOT supported (not connected to ground)
  findUnsupported() {
    const n = this.grid.length;
    const seen = new Uint8Array(n);
    const q = new Int32Array(this.alive + 8);
    let qh = 0, qt = 0;
    // seed: everything at y=0
    const layer = this.sx * this.sz;
    for (let i = 0; i < layer && i < n; i++) if (this.grid[i] && !seen[i]) { seen[i] = 1; q[qt++] = i; }
    const nb = (x, y, z, arr) => { /* inline below */ };
    while (qh < qt) {
      const vi = q[qh++];
      const [x, y, z] = this.decode(vi);
      const cands = [[x + 1, y, z], [x - 1, y, z], [x, y + 1, z], [x, y - 1, z], [x, y, z + 1], [x, y, z - 1]];
      for (const [cx, cy, cz] of cands) {
        if (cx < 0 || cy < 0 || cz < 0 || cx >= this.sx || cy >= this.sy || cz >= this.sz) continue;
        const ci = this.idx(cx, cy, cz);
        if (this.grid[ci] && !seen[ci]) { seen[ci] = 1; if (qt < q.length) q[qt++] = ci; }
      }
    }
    // gather unsupported into components
    const comps = [];
    const cseen = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (!this.grid[i] || seen[i] || cseen[i]) continue;
      const comp = [];
      const cq = [i]; cseen[i] = 1;
      while (cq.length) {
        const vi = cq.pop();
        comp.push(vi);
        const [x, y, z] = this.decode(vi);
        const cands = [[x + 1, y, z], [x - 1, y, z], [x, y + 1, z], [x, y - 1, z], [x, y, z + 1], [x, y, z - 1]];
        for (const [cx, cy, cz] of cands) {
          if (cx < 0 || cy < 0 || cz < 0 || cx >= this.sx || cy >= this.sy || cz >= this.sz) continue;
          const ci = this.idx(cx, cy, cz);
          if (this.grid[ci] && !seen[ci] && !cseen[ci]) { cseen[ci] = 1; cq.push(ci); }
        }
      }
      comps.push(comp);
    }
    return comps;
  }
  dispose(scene) { scene.remove(this.mesh); this.mesh.dispose(); }
}

// ---- World ----
export class World {
  constructor(scene) {
    this.scene = scene;
    this.buildings = [];
    this.mapIndex = 0;
    this.mapName = '';
    this._structTimer = 0;
    this._tmpV = new THREE.Vector3();
    this._buildEnvironment();
  }

  _buildEnvironment() {
    const scene = this.scene;
    // sky dome
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 64; skyCanvas.height = 512;
    const sc = skyCanvas.getContext('2d');
    const grad = sc.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, '#251543');
    grad.addColorStop(0.45, '#592f5e');
    grad.addColorStop(0.68, '#a84a5e');
    grad.addColorStop(0.82, '#e8703f');
    grad.addColorStop(0.92, '#ffb469');
    grad.addColorStop(1.0, '#ffd08a');
    sc.fillStyle = grad; sc.fillRect(0, 0, 64, 512);
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(320, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
    );
    sky.position.y = -6;
    scene.add(sky);


    // lights
    const hemi = new THREE.HemisphereLight(0x8a6fb8, 0x6b4526, 1.15);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffb070, 2.6);
    sun.position.set(55, 26, 35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc2 = sun.shadow.camera;
    sc2.left = -62; sc2.right = 62; sc2.top = 62; sc2.bottom = -62; sc2.near = 5; sc2.far = 220;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
    scene.add(sun); scene.add(sun.target);
    const rim = new THREE.DirectionalLight(0xff7a9a, 0.65);
    rim.position.set(-40, 14, -50);
    scene.add(rim);

    // ground
    this.groundCanvas = document.createElement('canvas');
    this.groundCanvas.width = 1024; this.groundCanvas.height = 1024;
    this.groundTex = new THREE.CanvasTexture(this.groundCanvas);
    this.groundTex.colorSpace = THREE.SRGBColorSpace;
    this.groundTex.anisotropy = 4;
    const gmat = new THREE.MeshStandardMaterial({ map: this.groundTex, roughness: 0.95, metalness: 0 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE), gmat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    // dark apron beyond map
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshStandardMaterial({ color: 0x6e5138, roughness: 1 })
    );
    apron.rotation.x = -Math.PI / 2; apron.position.y = -0.12;
    apron.receiveShadow = true;
    scene.add(apron);
  }

  _drawGround(roads) {
    const ctx = this.groundCanvas.getContext('2d');
    const S = 1024, W = GROUND_SIZE;
    const px = (v) => (v + W / 2) / W * S;
    ctx.fillStyle = '#8f7350'; ctx.fillRect(0, 0, S, S);
    // mottling
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * S, y = Math.random() * S, r = 2 + Math.random() * 9;
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(120,92,58,0.25)' : 'rgba(160,130,88,0.22)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    // dry grass patches
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * S, y = Math.random() * S, r = 8 + Math.random() * 26;
      ctx.fillStyle = 'rgba(122,116,60,0.14)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    // roads
    ctx.lineCap = 'round';
    for (const [x1, z1, x2, z2, w] of roads) {
      ctx.strokeStyle = '#5b524c';
      ctx.lineWidth = w / W * S;
      ctx.beginPath(); ctx.moveTo(px(x1), px(z1)); ctx.lineTo(px(x2), px(z2)); ctx.stroke();
      // center dashes
      ctx.strokeStyle = 'rgba(222,200,150,0.5)';
      ctx.lineWidth = 3;
      ctx.setLineDash([18, 26]);
      ctx.beginPath(); ctx.moveTo(px(x1), px(z1)); ctx.lineTo(px(x2), px(z2)); ctx.stroke();
      ctx.setLineDash([]);
    }
    // edge vignette
    const vg = ctx.createRadialGradient(S / 2, S / 2, S * 0.35, S / 2, S / 2, S * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(60,35,20,0.35)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, S, S);
    this.groundTex.needsUpdate = true;
  }

  buildMap(index) {
    for (const b of this.buildings) b.dispose(this.scene);
    this.buildings = [];
    this.mapIndex = index;
    const map = MAPS[index];
    this.mapName = map.name;
    this._drawGround(map.roads.map((r) => r.map((v) => v * WORLD_SCALE)));
    const placed = [];
    for (const [type, x, z, rot] of map.b) {
      const grid = BUILDING_TYPES[type]().rotY(rot).upscale(WORLD_SCALE).hollow();
      const wx = x * WORLD_SCALE, wz = z * WORLD_SCALE;
      const hw = grid.sx / 2, hd = grid.sz / 2;
      const box = [wx - hw, wz - hd, wx + hw, wz + hd];
      let bad = false;
      for (const p of placed) {
        if (box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1]) { bad = true; break; }
      }
      if (bad) { console.warn('Map overlap, skipping', type, x, z); continue; }
      placed.push(box);
      this.buildings.push(new Building(this.scene, grid, wx, wz, type));
    }
    this.totalVoxels = this.buildings.reduce((a, b) => a + b.total, 0);
  }

  damagePct() {
    let alive = 0;
    for (const b of this.buildings) alive += b.alive;
    return this.totalVoxels ? 1 - alive / this.totalVoxels : 0;
  }

  occupiedAt(p) {
    if (p.y < 0 || p.y > 20 * WORLD_SCALE) return false;
    for (const b of this.buildings) {
      if (b.alive && b.aabb.containsPoint(p) && b.occWorld(p)) return true;
    }
    return false;
  }

  // Sphere destruction (explosions). Returns voxels destroyed.
  destroySphere(game, playerIdx, center, radius, opts = {}) {
    const r2 = radius * radius;
    const debrisScale = (opts.debris ?? 1) * (game.cfg.debrisAmount ?? 1);
    let totalPts = 0, totalDestroyed = 0;
    const affected = [];
    const v = this._tmpV;
    for (const b of this.buildings) {
      if (!b.alive) continue;
      if (b.aabb.distanceToPoint(center) > radius) continue;
      const x0 = Math.max(0, Math.floor(center.x - b.origin.x - radius));
      const x1 = Math.min(b.sx - 1, Math.ceil(center.x - b.origin.x + radius));
      const y0 = Math.max(0, Math.floor(center.y - radius));
      const y1 = Math.min(b.sy - 1, Math.ceil(center.y + radius));
      const z0 = Math.max(0, Math.floor(center.z - b.origin.z - radius));
      const z1 = Math.min(b.sz - 1, Math.ceil(center.z - b.origin.z + radius));
      if (x0 > x1 || y0 > y1 || z0 > z1) continue;
      let destroyed = 0;
      const scorchR2 = (radius * 1.7) * (radius * 1.7);
      for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const vi = b.idx(x, y, z);
        if (!b.grid[vi]) continue;
        v.set(b.origin.x + x + 0.5, y + 0.5, b.origin.z + z + 0.5);
        const d2 = v.distanceToSquared(center);
        if (d2 <= r2) {
          const rec = b.destroyVoxel(vi);
          if (rec) {
            destroyed++;
            const falloff = 1 - Math.sqrt(d2) / (radius + 0.001);
            if (Math.random() < 0.45 * debrisScale) {
              const dir = rec.pos.clone().sub(center);
              if (dir.lengthSq() < 0.01) dir.set(Math.random() - 0.5, 1, Math.random() - 0.5);
              dir.normalize();
              const sp = 5 + 13 * falloff * (0.5 + Math.random());
              const vel = dir.multiplyScalar(sp);
              vel.y += 3 + Math.random() * 6;
              game.physics.spawnDebris(rec.pos, rec.color, vel);
            }
          }
        }
      }
      // scorch ring
      const sx0 = Math.max(0, Math.floor(center.x - b.origin.x - radius * 1.7));
      const sx1 = Math.min(b.sx - 1, Math.ceil(center.x - b.origin.x + radius * 1.7));
      const sy0 = Math.max(0, Math.floor(center.y - radius * 1.7));
      const sy1 = Math.min(b.sy - 1, Math.ceil(center.y + radius * 1.7));
      const sz0 = Math.max(0, Math.floor(center.z - b.origin.z - radius * 1.7));
      const sz1 = Math.min(b.sz - 1, Math.ceil(center.z - b.origin.z + radius * 1.7));
      for (let y = sy0; y <= sy1; y++) for (let z = sz0; z <= sz1; z++) for (let x = sx0; x <= sx1; x++) {
        const vi = b.idx(x, y, z);
        if (!b.grid[vi]) continue;
        v.set(b.origin.x + x + 0.5, y + 0.5, b.origin.z + z + 0.5);
        const d2 = v.distanceToSquared(center);
        if (d2 > r2 && d2 <= scorchR2 && Math.random() < 0.65) {
          b.scorchVoxel(vi, 0.45 * (1 - (Math.sqrt(d2) - radius) / (radius * 0.7 + 0.001)));
        }
      }
      if (destroyed > 0) {
        totalDestroyed += destroyed;
        totalPts += destroyed * b.ppv;
        b.dirty = true; b.lastPlayer = playerIdx;
        affected.push(b);
      }
    }
    if (totalPts > 0) game.award(playerIdx, totalPts, center, null, 'pts');
    for (const b of affected) this._checkRazed(game, b, playerIdx);
    return totalDestroyed;
  }

  // Oriented-box destruction (bulldozer blade). push = world dir Vector3
  destroyOBB(game, playerIdx, center, half, yaw, push) {
    const cos = Math.cos(-yaw), sin = Math.sin(-yaw);
    const reach = Math.hypot(half.x, half.z) + 0.9;
    let totalPts = 0, totalDestroyed = 0;
    const v = this._tmpV;
    for (const b of this.buildings) {
      if (!b.alive) continue;
      if (b.aabb.distanceToPoint(center) > reach) continue;
      const x0 = Math.max(0, Math.floor(center.x - b.origin.x - reach));
      const x1 = Math.min(b.sx - 1, Math.ceil(center.x - b.origin.x + reach));
      const y0 = Math.max(0, Math.floor(center.y - half.y - 0.5));
      const y1 = Math.min(b.sy - 1, Math.ceil(center.y + half.y + 0.5));
      const z0 = Math.max(0, Math.floor(center.z - b.origin.z - reach));
      const z1 = Math.min(b.sz - 1, Math.ceil(center.z - b.origin.z + reach));
      let destroyed = 0;
      for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const vi = b.idx(x, y, z);
        if (!b.grid[vi]) continue;
        const wx = b.origin.x + x + 0.5 - center.x;
        const wy = y + 0.5 - center.y;
        const wz = b.origin.z + z + 0.5 - center.z;
        const lx = wx * cos - wz * sin;
        const lz = wx * sin + wz * cos;
        if (Math.abs(lx) <= half.x && Math.abs(wy) <= half.y && Math.abs(lz) <= half.z) {
          const rec = b.destroyVoxel(vi);
          if (rec) {
            destroyed++;
            if (Math.random() < 0.55) {
              const vel = push.clone().multiplyScalar(5 + Math.random() * 5);
              vel.y += 3 + Math.random() * 5;
              vel.x += (Math.random() - 0.5) * 4;
              vel.z += (Math.random() - 0.5) * 4;
              game.physics.spawnDebris(rec.pos, rec.color, vel);
            }
          }
        }
      }
      if (destroyed > 0) {
        totalDestroyed += destroyed;
        totalPts += destroyed * b.ppv;
        b.dirty = true; b.lastPlayer = playerIdx;
      }
    }
    if (totalPts > 0) game.award(playerIdx, totalPts, center, null, 'tick');
    return totalDestroyed;
  }

  // periodic structural pass: unsupported chunks break off and fall
  update(dt, game) {
    // active collapses tick every frame
    for (const b of this.buildings) {
      if (b.collapseAnim) this._tickCollapse(dt, game, b);
    }
    this._structTimer += dt;
    if (this._structTimer < 0.12) return;
    this._structTimer = 0;
    for (const b of this.buildings) {
      if (b.collapseAnim) { b.dirty = false; continue; }
      if (!b.dirty || !b.alive) { b.dirty = false; continue; }
      b.dirty = false;
      const comps = b.findUnsupported();
      if (!comps.length) { this._checkRazed(game, b, b.lastPlayer); continue; }
      let pts = 0;
      const centroid = new THREE.Vector3();
      let nAll = 0;
      for (const comp of comps) {
        pts += comp.length * b.ppv;
        if (comp.length <= 4) {
          for (const vi of comp) {
            const rec = b.destroyVoxel(vi);
            if (rec) {
              centroid.add(rec.pos); nAll++;
              game.physics.spawnDebris(rec.pos, rec.color, new THREE.Vector3((Math.random() - 0.5) * 2, -1 - Math.random() * 2, (Math.random() - 0.5) * 2));
            }
          }
        } else {
          const recs = [];
          for (const vi of comp) {
            const rec = b.destroyVoxel(vi);
            if (rec) { recs.push(rec); centroid.add(rec.pos); nAll++; }
          }
          game.physics.spawnCluster(recs);
        }
      }
      if (pts > 0 && nAll > 0) {
        centroid.divideScalar(nAll);
        game.award(b.lastPlayer, pts, centroid, null, 'pts');
        game.onCollapse(nAll);
      }
      this._checkRazed(game, b, b.lastPlayer);
    }
  }

  // When enough of a building is gone, the whole thing loses integrity and comes down.
  // Staged demolition: tremble → progressive pancake (structure sinks + leans while
  // floors crush at the base, wall chunks peel off) → remains break into tumbling chunks.
  _collapseBuilding(game, b, playerIdx) {
    if (b.razed || b.collapsed) return;
    b.collapsed = true;
    const la = Math.random() * Math.PI * 2;
    b.collapseAnim = {
      t: 0, phase: 'tremble', vel: 0, dropped: 0,
      leanAxis: new THREE.Vector3(Math.cos(la), 0, Math.sin(la)),
      lean: 0, leanMax: 0.06 + Math.random() * 0.1,
      playerIdx, pts: 0, layerTick: 0, startAlive: b.alive,
    };
    game.sfx.rumble(0.7);
    game.shake(0.25);
    const span = Math.max(b.sx, b.sz);
    game.physics.spawnDust(new THREE.Vector3(b.center.x, 0.8, b.center.z), 8, { spread: span * 0.55, up: 2, out: 3.5, scale: 0.9 });
  }

  _tickCollapse(dt, game, b) {
    const a = b.collapseAnim;
    if (!a) return;
    const mesh = b.mesh;
    const cx = b.center.x, cz = b.center.z;
    a.t += dt;
    if (a.phase === 'tremble') {
      // structure shudders in place, dust bleeds from the facade
      const amp = 0.14 * Math.min(1, a.t / 0.12);
      mesh.position.set((Math.random() - 0.5) * 2 * amp, 0, (Math.random() - 0.5) * 2 * amp);
      if (Math.random() < dt * 26) {
        _tv.set(b.origin.x + Math.random() * b.sx, 1 + Math.random() * (b.sy * 0.7), b.origin.z + Math.random() * b.sz);
        game.physics.spawnDust(_tv, 2, { spread: 0.8, up: 1.2, out: 2.2, scale: 0.7 });
      }
      if (a.t >= 0.55) { a.phase = 'fall'; game.sfx.rumble(1.1); }
      return;
    }
    // fall: gravity pulls the whole structure down; a lean develops as it goes
    a.vel += 34 * dt;
    a.dropped += a.vel * dt;
    a.lean = Math.min(a.leanMax, a.lean + a.vel * dt * 0.0045);
    // crush layers whose centers have passed below ground
    let guard = 0;
    const lsz = b.sx * b.sz;
    while (b.alive > 0 && guard++ < 8) {
      let low = -1;
      for (let y = b._lowY; y < b.sy; y++) {
        const s0 = y * lsz, s1 = s0 + lsz;
        let any = false;
        for (let i = s0; i < s1; i++) if (b.grid[i]) { any = true; break; }
        if (any) { low = y; break; }
        b._lowY = y + 1;
      }
      if (low < 0) break;
      if (low + 0.5 - a.dropped > 0) break;
      this._consumeLayer(game, b, a, low);
      b._lowY = low + 1;
    }
    if (b.alive <= Math.max(10, a.startAlive * 0.16)) { this._finishCollapse(game, b, a); return; }
    // apply drop + lean (pivot at base center)
    _tv.set(-a.leanAxis.z, 0, a.leanAxis.x);
    mesh.quaternion.setFromAxisAngle(_tv, a.lean);
    _tv2.set(cx, 0, cz).applyQuaternion(mesh.quaternion);
    mesh.position.set(cx - _tv2.x, -a.dropped - _tv2.y, cz - _tv2.z);
  }

  _consumeLayer(game, b, a, y) {
    const lsz = b.sx * b.sz;
    const s0 = y * lsz;
    const cx = b.center.x, cz = b.center.z;
    const debrisScale = game.cfg.debrisAmount ?? 1;
    let count = 0;
    for (let i = s0; i < s0 + lsz; i++) {
      if (!b.grid[i]) continue;
      const rec = b.destroyVoxel(i);
      if (!rec) continue;
      count++;
      a.pts += b.ppv;
      rec.pos.y = Math.max(0.4, rec.pos.y - a.dropped);
      if (Math.random() < 0.15 * debrisScale) {
        // kick rubble outward from the crush zone
        let dx = rec.pos.x - cx, dz = rec.pos.z - cz;
        const len = Math.hypot(dx, dz) || 1;
        dx /= len; dz /= len;
        const sp = 5 + Math.random() * 9;
        game.physics.spawnDebris(rec.pos, rec.color, _tv.set(dx * sp, 2 + Math.random() * 5, dz * sp), 0.55);
      }
    }
    if (!count) return;
    a.layerTick++;
    // ground-level dust ring pulses out with every crushed floor
    game.physics.spawnDust(_tv.set(cx, 0.5, cz), 3, { spread: Math.max(b.sx, b.sz) * 0.55, up: 2.4, out: 6.5, scale: 1.0 });
    game.shake(0.09);
    if (a.layerTick % 3 === 1) game.sfx.rumble(0.4);
    // walls shear off and tumble away as the structure comes down
    if (Math.random() < 0.55) this._peelChunk(game, b, a);
  }

  _peelChunk(game, b, a) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const vi = (Math.random() * b.grid.length) | 0;
      if (!b.grid[vi]) continue;
      const [x, y, z] = b.decode(vi);
      if (y - a.dropped < 3) continue; // only airborne wall chunks
      const recs = [];
      const x0 = Math.max(0, x - 1), x1 = Math.min(b.sx - 1, x + 1);
      const y0 = Math.max(b._lowY, y - 1), y1 = Math.min(b.sy - 1, y + 2);
      const z0 = Math.max(0, z - 1), z1 = Math.min(b.sz - 1, z + 1);
      for (let yy = y0; yy <= y1; yy++) for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++) {
        const rec = b.destroyVoxel(b.idx(xx, yy, zz));
        if (rec) { rec.pos.y = Math.max(0.6, rec.pos.y - a.dropped); recs.push(rec); a.pts += b.ppv; }
      }
      if (recs.length) {
        let dx = recs[0].pos.x - b.center.x, dz = recs[0].pos.z - b.center.z;
        const len = Math.hypot(dx, dz) || 1;
        dx /= len; dz /= len;
        game.physics.spawnCluster(recs, {
          vel: new THREE.Vector3(dx * (3.5 + Math.random() * 4), 1 + Math.random() * 2.5, dz * (3.5 + Math.random() * 4)),
          av: new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 5),
        });
      }
      return;
    }
  }

  _finishCollapse(game, b, a) {
    // remains break apart into tumbling chunks
    const CELL = 4;
    const groups = new Map();
    for (let vi = 0; vi < b.grid.length; vi++) {
      if (!b.grid[vi]) continue;
      const [x, y, z] = b.decode(vi);
      const key = ((x / CELL) | 0) + ',' + ((z / CELL) | 0);
      let arr = groups.get(key);
      if (!arr) { arr = []; groups.set(key, arr); }
      arr.push(vi);
    }
    let nAll = 0;
    const centroid = new THREE.Vector3();
    for (const arr of groups.values()) {
      const recs = [];
      for (const vi of arr) {
        const rec = b.destroyVoxel(vi);
        if (rec) {
          rec.pos.y = Math.max(0.6, rec.pos.y - a.dropped);
          recs.push(rec); centroid.add(rec.pos); nAll++; a.pts += b.ppv;
        }
      }
      if (recs.length) {
        let dx = recs[0].pos.x - b.center.x, dz = recs[0].pos.z - b.center.z;
        const len = Math.hypot(dx, dz) || 1;
        game.physics.spawnCluster(recs, {
          vel: new THREE.Vector3((dx / len) * (2 + Math.random() * 3), -1, (dz / len) * (2 + Math.random() * 3)),
          av: new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 3),
        });
      }
    }
    // finale: shockwave, crater, dust plume
    const span = Math.max(b.sx, b.sz);
    const c = new THREE.Vector3(b.center.x, 0.8, b.center.z);
    game.physics.spawnDust(c, 20, { spread: span * 0.7, up: 4.5, out: 8, scale: 1.35 });
    game.physics.shockwave(c, span * 0.55);
    game.physics.addCrater(c, span * 0.5);
    game.sfx.rumble(1.35);
    game.shake(1.0);
    // reset mesh transform (all instances are gone)
    b.mesh.position.set(0, 0, 0);
    b.mesh.quaternion.identity();
    if (nAll > 0) {
      centroid.divideScalar(nAll);
      game.award(a.playerIdx, a.pts, centroid, null, 'pts');
    }
    b.collapseAnim = null;
    b.razed = true;
    game.onRazed(b, a.playerIdx, true);
  }

  _checkRazed(game, b, playerIdx) {
    if (b.razed || b.collapseAnim) return;
    // 50%+ destroyed → structural failure, the building comes down and crumbles
    const collapseAt = game.cfg.collapseThreshold ?? 0.5;
    if (collapseAt > 0 && b.alive > 0 && b.alive <= b.total * (1 - collapseAt)) {
      this._collapseBuilding(game, b, playerIdx);
      return;
    }
    const thresh = Math.max(2, Math.floor(b.total * 0.03));
    if (b.alive > thresh) return;
    // clear stragglers
    for (let vi = 0; vi < b.grid.length && b.alive > 0; vi++) {
      if (b.grid[vi]) {
        const rec = b.destroyVoxel(vi);
        if (rec) game.physics.spawnDebris(rec.pos, rec.color, new THREE.Vector3((Math.random() - 0.5) * 5, 3 + Math.random() * 4, (Math.random() - 0.5) * 5));
      }
    }
    b.razed = true;
    game.onRazed(b, playerIdx);
  }
}
