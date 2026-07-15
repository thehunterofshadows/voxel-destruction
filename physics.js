// physics.js — debris, falling clusters, rubble, dust, craters, shockwaves
import * as THREE from 'three';

const G = 30;
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);

const DEBRIS_CAP = 1600;
const CLUSTER_CAP = 6000;
const DUST_CAP = 520;

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

export class Physics {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;

    // ---- debris pool ----
    const dMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.05 });
    this.debrisMesh = new THREE.InstancedMesh(boxGeo, dMat, DEBRIS_CAP);
    this.debrisMesh.castShadow = true;
    this.debrisMesh.frustumCulled = false;
    for (let i = 0; i < DEBRIS_CAP; i++) this.debrisMesh.setMatrixAt(i, ZERO_M);
    scene.add(this.debrisMesh);
    this.debris = [];
    for (let i = 0; i < DEBRIS_CAP; i++) {
      this.debris.push({
        on: false, slot: i, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        rot: new THREE.Vector3(), av: new THREE.Vector3(), scale: 0.7,
        life: 0, rest: false, dusted: false,
      });
    }
    this.debrisCursor = 0;

    // ---- cluster / rubble pool ----
    const cMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.05 });
    this.clusterMesh = new THREE.InstancedMesh(boxGeo, cMat, CLUSTER_CAP);
    this.clusterMesh.castShadow = true;
    this.clusterMesh.receiveShadow = true;
    this.clusterMesh.frustumCulled = false;
    for (let i = 0; i < CLUSTER_CAP; i++) this.clusterMesh.setMatrixAt(i, ZERO_M);
    scene.add(this.clusterMesh);
    this.freeSlots = [];
    for (let i = CLUSTER_CAP - 1; i >= 0; i--) this.freeSlots.push(i);
    this.clusters = [];
    this.rubble = []; // slots, oldest first

    // ---- dust pool ----
    const duMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false });
    this.dustMesh = new THREE.InstancedMesh(boxGeo, duMat, DUST_CAP);
    this.dustMesh.frustumCulled = false;
    for (let i = 0; i < DUST_CAP; i++) this.dustMesh.setMatrixAt(i, ZERO_M);
    scene.add(this.dustMesh);
    this.dust = [];
    for (let i = 0; i < DUST_CAP; i++) {
      this.dust.push({ on: false, slot: i, pos: new THREE.Vector3(), vel: new THREE.Vector3(), s0: 1, life: 0, max: 1, spin: Math.random() * 3 });
    }
    this.dustCursor = 0;
    this.dustColors = [new THREE.Color('#cfa878'), new THREE.Color('#a8927c'), new THREE.Color('#6b5a4c'), new THREE.Color('#e0c090')];

    // ---- shockwaves ----
    this.waves = [];
    const wGeo = new THREE.RingGeometry(0.82, 1, 40);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(wGeo, new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      this.waves.push({ mesh: m, t: 1, r: 1 });
    }

    // ---- craters ----
    this.craters = [];
    this.craterGeo = new THREE.CircleGeometry(1, 24);
    this.craterCursor = 0;
    for (let i = 0; i < 44; i++) {
      const m = new THREE.Mesh(this.craterGeo, new THREE.MeshBasicMaterial({ color: 0x2a1c12, transparent: true, opacity: 0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.02 + i * 0.0006;
      m.visible = false;
      scene.add(m);
      this.craters.push({ mesh: m, life: 0 });
    }
  }

  reset() {
    for (const d of this.debris) { d.on = false; this.debrisMesh.setMatrixAt(d.slot, ZERO_M); }
    this.debrisMesh.instanceMatrix.needsUpdate = true;
    for (const c of this.clusters) for (const vx of c.voxels) this._freeClusterSlot(vx.slot);
    this.clusters = [];
    for (const slot of this.rubble) this._freeClusterSlot(slot);
    this.rubble = [];
    this.clusterMesh.instanceMatrix.needsUpdate = true;
    for (const d of this.dust) d.on = false;
    for (const c of this.craters) { c.life = 0; c.mesh.visible = false; }
    for (const w of this.waves) { w.t = 1; w.mesh.visible = false; }
  }

  _freeClusterSlot(slot) {
    this.clusterMesh.setMatrixAt(slot, ZERO_M);
    this.freeSlots.push(slot);
  }

  spawnDebris(pos, color, vel, scale) {
    const d = this.debris[this.debrisCursor];
    this.debrisCursor = (this.debrisCursor + 1) % DEBRIS_CAP;
    d.on = true; d.rest = false; d.dusted = false;
    d.pos.copy(pos);
    d.pos.x += (Math.random() - 0.5) * 0.3;
    d.pos.z += (Math.random() - 0.5) * 0.3;
    d.vel.copy(vel);
    d.rot.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    d.av.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
    d.scale = scale ?? (0.45 + Math.random() * 0.4);
    d.life = 9 + Math.random() * 5;
    this.debrisMesh.setColorAt(d.slot, color);
    if (this.debrisMesh.instanceColor) this.debrisMesh.instanceColor.needsUpdate = true;
  }

  // recs: [{pos: Vector3, color: Color}] — falls as one rigid chunk, settles into rubble
  // opts: {vel: Vector3, av: Vector3} initial velocity / tumble
  spawnCluster(recs, opts = {}) {
    const n = recs.length;
    // reclaim rubble slots if needed
    let need = n - this.freeSlots.length;
    while (need > 0 && this.rubble.length) { this._freeClusterSlot(this.rubble.shift()); need--; }
    const centroid = new THREE.Vector3();
    for (const r of recs) centroid.add(r.pos);
    centroid.divideScalar(n);
    const voxels = [];
    let spill = 0;
    for (const r of recs) {
      if (!this.freeSlots.length) {
        // no slots — spill to debris
        this.spawnDebris(r.pos, r.color, _v.set((Math.random() - 0.5) * 3, -2, (Math.random() - 0.5) * 3), 0.8);
        spill++;
        continue;
      }
      const slot = this.freeSlots.pop();
      this.clusterMesh.setColorAt(slot, r.color);
      voxels.push({ off: r.pos.clone().sub(centroid), slot, from: new THREE.Vector3(), to: new THREE.Vector3(), yaw: (Math.random() - 0.5) * 0.9 });
    }
    if (this.clusterMesh.instanceColor) this.clusterMesh.instanceColor.needsUpdate = true;
    if (!voxels.length) return;
    const av = opts.av ? opts.av.clone() : new THREE.Vector3((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 1.4);
    const vel = opts.vel ? opts.vel.clone() : new THREE.Vector3((Math.random() - 0.5) * 1.5, -0.5, (Math.random() - 0.5) * 1.5);
    this.clusters.push({
      voxels,
      pos: centroid.clone(),
      quat: new THREE.Quaternion(),
      vel,
      av,
      state: 'fall',
      settleT: 0,
      n: voxels.length,
    });
  }

  spawnDust(pos, count, opts = {}) {
    const ex = this.game.cfg.explosiveness ?? 1;
    count = Math.round(count * ex);
    if (count < 1) return;
    const spread = opts.spread ?? 1.6;
    const up = (opts.up ?? 5) * (0.6 + 0.4 * ex);
    const out = (opts.out ?? 4) * (0.6 + 0.4 * ex);
    const base = opts.scale ?? 1;
    for (let i = 0; i < count; i++) {
      const du = this.dust[this.dustCursor];
      this.dustCursor = (this.dustCursor + 1) % DUST_CAP;
      du.on = true;
      du.pos.set(pos.x + (Math.random() - 0.5) * spread, Math.max(0.3, pos.y + (Math.random() - 0.5) * spread), pos.z + (Math.random() - 0.5) * spread);
      const a = Math.random() * Math.PI * 2;
      du.vel.set(Math.cos(a) * out * (0.3 + Math.random()), up * (0.4 + Math.random() * 0.8), Math.sin(a) * out * (0.3 + Math.random()));
      du.s0 = base * (0.5 + Math.random() * 0.9);
      du.max = 0.8 + Math.random() * 0.7;
      du.life = du.max;
      const c = this.dustColors[(Math.random() * this.dustColors.length) | 0];
      this.dustMesh.setColorAt(du.slot, c);
    }
    if (this.dustMesh.instanceColor) this.dustMesh.instanceColor.needsUpdate = true;
  }

  shockwave(pos, radius) {
    let w = this.waves.find((w) => w.t >= 1);
    if (!w) w = this.waves[0];
    w.t = 0; w.r = radius * 3.2;
    w.mesh.position.set(pos.x, 0.15, pos.z);
    w.mesh.visible = true;
  }

  addCrater(pos, r) {
    const c = this.craters[this.craterCursor];
    this.craterCursor = (this.craterCursor + 1) % this.craters.length;
    c.life = 45;
    c.mesh.visible = true;
    c.mesh.position.x = pos.x; c.mesh.position.z = pos.z;
    c.mesh.scale.setScalar(r * (1.2 + Math.random() * 0.5));
    c.mesh.material.opacity = 0.5;
    c.mesh.rotation.z = Math.random() * Math.PI;
  }

  update(dt, world) {
    // ---- debris ----
    let dm = false;
    for (const d of this.debris) {
      if (!d.on) continue;
      dm = true;
      d.life -= dt;
      if (d.life <= 0) {
        d.on = false;
        this.debrisMesh.setMatrixAt(d.slot, ZERO_M);
        continue;
      }
      if (!d.rest) {
        d.vel.y -= G * dt;
        d.pos.addScaledVector(d.vel, dt);
        d.rot.addScaledVector(d.av, dt);
        const hs = d.scale * 0.5;
        if (d.pos.y < hs) {
          d.pos.y = hs;
          if (Math.abs(d.vel.y) > 3.5) {
            if (!d.dusted && Math.abs(d.vel.y) > 7) { d.dusted = true; }
            d.vel.y = -d.vel.y * 0.32;
            d.vel.x *= 0.6; d.vel.z *= 0.6;
            d.av.multiplyScalar(0.5);
          } else {
            d.vel.set(0, 0, 0);
            d.av.set(0, 0, 0);
            d.rest = true;
          }
        }
      }
      const fade = d.life < 0.45 ? d.life / 0.45 : 1;
      _e.set(d.rot.x, d.rot.y, d.rot.z);
      _q.setFromEuler(_e);
      _m4.compose(d.pos, _q, _v.setScalar(d.scale * fade));
      this.debrisMesh.setMatrixAt(d.slot, _m4);
    }
    if (dm) this.debrisMesh.instanceMatrix.needsUpdate = true;

    // ---- clusters ----
    let cm = false;
    for (let ci = this.clusters.length - 1; ci >= 0; ci--) {
      const c = this.clusters[ci];
      cm = true;
      if (c.state === 'fall') {
        c.vel.y -= G * 0.85 * dt;
        c.pos.addScaledVector(c.vel, dt);
        _e.set(c.av.x * dt, c.av.y * dt, c.av.z * dt);
        _q.setFromEuler(_e);
        c.quat.premultiply(_q).normalize();
        // write matrices + find lowest point
        let minY = Infinity;
        for (const vx of c.voxels) {
          _v.copy(vx.off).applyQuaternion(c.quat).add(c.pos);
          if (_v.y < minY) minY = _v.y;
          _m4.compose(_v, c.quat, _v2.setScalar(1));
          this.clusterMesh.setMatrixAt(vx.slot, _m4);
        }
        if (minY <= 0.5 || c.pos.y < -2) {
          // impact! switch to settle
          c.state = 'settle';
          c.settleT = 0;
          const pileH = Math.min(2.4, 0.4 + c.n / 60);
          for (const vx of c.voxels) {
            _v.copy(vx.off).applyQuaternion(c.quat).add(c.pos);
            vx.from.copy(_v);
            const rr = Math.pow(Math.random(), 1.6);
            vx.to.set(
              _v.x + (Math.random() - 0.5) * 2.2,
              0.5 + rr * pileH * Math.random(),
              _v.z + (Math.random() - 0.5) * 2.2
            );
          }
          // impact effects
          const g = this.game;
          g.sfx.rumble(Math.min(1.2, 0.3 + c.n / 160));
          g.shake(Math.min(0.9, 0.15 + c.n / 260));
          this.spawnDust(_v2.set(c.pos.x, 0.6, c.pos.z), Math.min(14, 4 + c.n / 12), { spread: Math.sqrt(c.n) * 0.4, up: 2.5, out: 5, scale: 1.0 });
          const chips = Math.min(40, c.n >> 3);
          for (let i = 0; i < chips; i++) {
            const vx = c.voxels[(Math.random() * c.voxels.length) | 0];
            this.clusterMesh.getColorAt(vx.slot, _tmpColor);
            this.spawnDebris(vx.from, _tmpColor, _v.set((Math.random() - 0.5) * 8, 2 + Math.random() * 6, (Math.random() - 0.5) * 8), 0.5);
          }
        }
      } else {
        // settle
        c.settleT += dt;
        const t = Math.min(1, c.settleT / 0.38);
        const ease = 1 - Math.pow(1 - t, 2);
        const wob = (1 - t);
        for (const vx of c.voxels) {
          _v.lerpVectors(vx.from, vx.to, ease);
          _e.set(vx.yaw * wob * 2, vx.yaw, vx.yaw * wob * 3);
          _q.setFromEuler(_e);
          _m4.compose(_v, _q, _v2.setScalar(1));
          this.clusterMesh.setMatrixAt(vx.slot, _m4);
        }
        if (t >= 1) {
          for (const vx of c.voxels) this.rubble.push(vx.slot);
          this.clusters.splice(ci, 1);
        }
      }
    }
    if (cm) this.clusterMesh.instanceMatrix.needsUpdate = true;

    // ---- dust ----
    let dum = false;
    for (let i = 0; i < DUST_CAP; i++) {
      const du = this.dust[i];
      if (!du.on) continue;
      dum = true;
      du.life -= dt;
      if (du.life <= 0) {
        du.on = false;
        this.dustMesh.setMatrixAt(i, ZERO_M);
        continue;
      }
      du.vel.multiplyScalar(1 - 2.2 * dt);
      du.vel.y += 1.5 * dt; // buoyancy
      du.pos.addScaledVector(du.vel, dt);
      const p = 1 - du.life / du.max;
      const s = du.s0 * (0.6 + 1.8 * p) * (p > 0.75 ? (1 - p) / 0.25 : 1);
      _e.set(0, du.spin * p * 2, 0);
      _q.setFromEuler(_e);
      _m4.compose(du.pos, _q, _v.setScalar(Math.max(0.001, s)));
      this.dustMesh.setMatrixAt(i, _m4);
    }
    if (dum) this.dustMesh.instanceMatrix.needsUpdate = true;

    // ---- waves ----
    for (const w of this.waves) {
      if (w.t >= 1) { w.mesh.visible = false; continue; }
      w.t += dt / 0.45;
      const t = Math.min(1, w.t);
      w.mesh.scale.setScalar(0.5 + w.r * t);
      w.mesh.material.opacity = 0.55 * (1 - t);
    }

    // ---- craters ----
    for (const c of this.craters) {
      if (!c.mesh.visible) continue;
      c.life -= dt;
      if (c.life <= 0) { c.mesh.visible = false; continue; }
      if (c.life < 6) c.mesh.material.opacity = 0.5 * (c.life / 6);
    }
  }
}

const _tmpColor = new THREE.Color();
