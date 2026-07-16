// weapons.js — mortar, airstrike, bulldozer
import * as THREE from 'three';
import { MAP_LIMIT, WORLD_SCALE } from './world.js';

const G = 26;
const S = WORLD_SCALE;
const SPD_MIN = 16;    // mortar muzzle speed range (tuned so shots cross the larger map)
const SPD_SPAN = 86;
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export const COSTS = { mortar: 300, strike: 1000, dozer: 300 };

export class Weapons {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.mode = 'none';
    this.aim = { az: 0, angle: 58, power: 62 };
    this._buildMortar();
    this._buildPreview();
    this.shell = null;
    this.strike = { phase: 'idle', A: new THREE.Vector3(), B: new THREE.Vector3(), plane: null, bombs: [], targets: [], s: 0, dir: new THREE.Vector3(), engine: null };
    this._buildStrikeViz();
    this.dozer = { active: false, mesh: null, t: 0, pos: new THREE.Vector3(), yaw: 0, spd: 0, input: { f: 0, s: 0 }, engine: null, puffT: 0, scoreT: 0 };
  }

  get busy() {
    return !!this.shell || this.strike.phase === 'run' || this.dozer.active;
  }

  setMode(m) {
    if (this.busy && m !== this.mode) return false;
    this.mode = m;
    this.previewGroup.visible = m === 'mortar';
    if (m !== 'strike') this._resetStrikeDraw();
    return true;
  }

  // ================= MORTAR =================
  _buildMortar() {
    const g = new THREE.Group();
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.7, metalness: 0.4 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 3), baseMat);
    base.position.y = 0.4;
    base.castShadow = true;
    g.add(base);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 0.7, 12), baseMat);
    ped.position.y = 1.1;
    g.add(ped);
    this.yawGroup = new THREE.Group();
    this.yawGroup.position.y = 1.3;
    g.add(this.yawGroup);
    this.pitchGroup = new THREE.Group();
    this.yawGroup.add(this.pitchGroup);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.45, 3.4, 12),
      new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.5, metalness: 0.6 })
    );
    barrel.position.y = 1.5;
    barrel.castShadow = true;
    this.pitchGroup.add(barrel);
    const muzzleRing = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), baseMat);
    muzzleRing.position.y = 3.1;
    this.pitchGroup.add(muzzleRing);
    g.position.set(0, 0, 40 * S);
    g.scale.setScalar(S);
    this.scene.add(g);
    this.mortarPos = new THREE.Vector3(0, 1.3 * S, 40 * S);
    this.mortarGroup = g;
    // shell mesh
    this.shellMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.4 * S, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x1e1a16, roughness: 0.4, metalness: 0.5 })
    );
    this.shellMesh.castShadow = true;
    this.shellMesh.visible = false;
    this.scene.add(this.shellMesh);
  }

  _buildPreview() {
    this.previewGroup = new THREE.Group();
    const dotGeo = new THREE.SphereGeometry(0.17 * S, 8, 6);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffe9b8, transparent: true, opacity: 0.85, depthWrite: false });
    this.dots = new THREE.InstancedMesh(dotGeo, dotMat, 130);
    this.dots.frustumCulled = false;
    this.previewGroup.add(this.dots);
    this.impactRing = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1, 32),
      new THREE.MeshBasicMaterial({ color: 0xff8a5c, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
    );
    this.impactRing.rotation.x = -Math.PI / 2;
    this.previewGroup.add(this.impactRing);
    this.previewGroup.visible = false;
    this.scene.add(this.previewGroup);
  }

  _aimVectors() {
    const azR = (this.aim.az * Math.PI) / 180;
    const elR = (this.aim.angle * Math.PI) / 180;
    const h = _v.set(Math.sin(azR), 0, -Math.cos(azR));
    const speed = SPD_MIN + (this.aim.power / 100) * SPD_SPAN;
    const vel = new THREE.Vector3(h.x * Math.cos(elR), Math.sin(elR), h.z * Math.cos(elR)).multiplyScalar(speed);
    const muzzle = this.mortarPos.clone().add(new THREE.Vector3(h.x * Math.cos(elR), Math.sin(elR), h.z * Math.cos(elR)).multiplyScalar(3.2 * S));
    muzzle.y += 0.4 * S;
    return { vel, muzzle };
  }

  _updateMortarPose() {
    this.yawGroup.rotation.y = -(this.aim.az * Math.PI) / 180;
    this.pitchGroup.rotation.x = -(Math.PI / 2 - (this.aim.angle * Math.PI) / 180);
  }

  _updatePreview() {
    this._updateMortarPose();
    const { vel, muzzle } = this._aimVectors();
    const p = muzzle.clone();
    const v = vel.clone();
    const dt = 1 / 50;
    let n = 0;
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 500 && n < 130; i++) {
      v.y -= G * dt;
      p.addScaledVector(v, dt);
      if (i % 3 === 0) {
        m4.makeTranslation(p.x, p.y, p.z);
        this.dots.setMatrixAt(n++, m4);
      }
      if (p.y <= 0.1 || (i > 8 && this.game.world.occupiedAt(p))) break;
    }
    this.dots.count = n;
    this.dots.instanceMatrix.needsUpdate = true;
    const pulse = 1 + 0.18 * Math.sin(performance.now() / 130);
    this.impactRing.position.set(p.x, Math.max(0.12, p.y), p.z);
    this.impactRing.scale.setScalar(2.9 * S * pulse);
  }

  fireMortar() {
    if (this.mode !== 'mortar' || this.shell) return false;
    if (!this.game.spend(COSTS.mortar)) return false;
    const { vel, muzzle } = this._aimVectors();
    this.shell = { p: muzzle.clone(), v: vel, trailT: 0, whistled: false };
    this.shellMesh.visible = true;
    this.shellMesh.position.copy(muzzle);
    this.game.sfx.thunk();
    this.game.shake(0.15);
    this.game.physics.spawnDust(muzzle, 5, { spread: 0.5, up: 3, out: 2, scale: 0.7 });
    return true;
  }

  _updateShell(dt) {
    const s = this.shell;
    const speed = s.v.length();
    const sub = Math.max(1, Math.ceil((speed * dt) / 0.3));
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      s.v.y -= G * h;
      s.p.addScaledVector(s.v, h);
      if (!s.whistled && s.v.y < 0) {
        s.whistled = true;
        this.game.sfx.whistle(Math.max(0.4, Math.min(1.6, (s.p.y / Math.abs(s.v.y)) * 1.1)));
      }
      if (s.p.y <= 0.15 || this.game.world.occupiedAt(s.p)) {
        const at = s.p.clone();
        at.y = Math.max(0.35, at.y);
        this.shell = null;
        this.shellMesh.visible = false;
        this.game.explode(at, 4.1 * S, this.game.state.player, 2);
        return;
      }
    }
    s.trailT += dt;
    if (s.trailT > 0.03) {
      s.trailT = 0;
      this.game.physics.spawnDust(s.p, 1, { spread: 0.1, up: 0.3, out: 0.2, scale: 0.45 });
    }
    this.shellMesh.position.copy(s.p);
  }

  // ================= AIRSTRIKE =================
  _buildStrikeViz() {
    this.strikeLine = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.18, 0.9),
      new THREE.MeshBasicMaterial({ color: 0xffb36b, transparent: true, opacity: 0.8, depthWrite: false })
    );
    this.strikeLine.visible = false;
    this.scene.add(this.strikeLine);
    const mk = () => {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.7, 1, 26),
        new THREE.MeshBasicMaterial({ color: 0xffe9b8, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.scene.add(m);
      return m;
    };
    this.strikeA = mk();
    this.strikeB = mk();
  }

  _resetStrikeDraw() {
    if (this.strike.phase === 'run') return;
    this.strike.phase = 'idle';
    this.strikeLine.visible = false;
    this.strikeA.visible = false;
    this.strikeB.visible = false;
  }

  onGround(type, pt) {
    if (!pt) return;
    if (this.mode === 'mortar' && !this.shell && (type === 'down' || type === 'move')) {
      this.aimAt(pt);
      return;
    }
    if (this.mode !== 'strike' || this.strike.phase === 'run') return;
    const st = this.strike;
    const clamp = (p) => { p.x = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, p.x)); p.z = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, p.z)); p.y = 0; return p; };
    if (type === 'down') {
      st.phase = 'drag';
      st.A.copy(clamp(pt));
      st.B.copy(st.A);
      this._updateStrikeViz();
    } else if (type === 'move' && st.phase === 'drag') {
      st.B.copy(clamp(pt));
      this._updateStrikeViz();
    } else if (type === 'up' && st.phase === 'drag') {
      st.B.copy(clamp(pt));
      if (st.A.distanceTo(st.B) >= 8 * S) {
        st.phase = 'pending';
        this._updateStrikeViz();
      } else {
        this._resetStrikeDraw();
      }
    }
  }

  // Tap-to-aim computes the shot internally so firing needs no manual controls.
  aimAt(pt) {
    const dx = pt.x - this.mortarPos.x;
    const dz = pt.z - this.mortarPos.z;
    const az = Math.atan2(dx, -dz) * (180 / Math.PI);
    this.aim.az = Math.max(-75, Math.min(75, az));
    const R = Math.max(2, Math.hypot(dx, dz));
    const th = (this.aim.angle * Math.PI) / 180;
    const s2 = Math.max(0.15, Math.sin(2 * th));
    const v = Math.sqrt((R * G) / s2);
    this.aim.power = Math.max(10, Math.min(100, ((v - SPD_MIN) / SPD_SPAN) * 100));
  }

  _updateStrikeViz() {
    const st = this.strike;
    const len = Math.max(0.5, st.A.distanceTo(st.B));
    const mid = _v.copy(st.A).add(st.B).multiplyScalar(0.5);
    this.strikeLine.visible = true;
    this.strikeLine.position.set(mid.x, 0.25, mid.z);
    this.strikeLine.scale.set(len, 1, 1);
    this.strikeLine.rotation.y = -Math.atan2(st.B.z - st.A.z, st.B.x - st.A.x);
    this.strikeA.visible = true;
    this.strikeA.position.set(st.A.x, 0.22, st.A.z);
    this.strikeA.scale.setScalar(1.6 * S);
    this.strikeB.visible = true;
    this.strikeB.position.set(st.B.x, 0.22, st.B.z);
    this.strikeB.scale.setScalar(2.4 * S);
  }

  confirmStrike() {
    const st = this.strike;
    if (st.phase !== 'pending') return false;
    if (!this.game.spend(COSTS.strike)) return false;
    st.phase = 'run';
    st.dir.copy(st.B).sub(st.A).normalize();
    const alt = 26 * S, speed = 34 * S;
    st.alt = alt; st.speed = speed;
    st.entry = st.A.clone().addScaledVector(st.dir, -80 * S);
    st.entry.y = alt;
    st.s = 0;
    st.exitS = st.A.distanceTo(st.B) + 170 * S;
    const tFall = Math.sqrt((2 * (alt - 0)) / G);
    st.targets = [];
    const segLen = st.A.distanceTo(st.B);
    for (let i = 0; i < 6; i++) {
      const t = 0.06 + (0.88 * i) / 5;
      const sTarget = 80 * S + segLen * t;
      st.targets.push({ sRelease: sTarget - speed * tFall, dropped: false });
    }
    if (!st.plane) st.plane = this._buildPlane();
    st.plane.visible = true;
    st.engine = this.game.sfx.engineStart('plane');
    this.strikeLine.visible = false;
    this.strikeA.visible = false;
    this.strikeB.visible = false;
    return true;
  }

  cancelStrike() {
    if (this.strike.phase === 'pending' || this.strike.phase === 'drag') this._resetStrikeDraw();
  }

  _buildPlane() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x7d8790, roughness: 0.5, metalness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.6 });
    const fus = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 7.5), mat);
    fus.castShadow = true;
    g.add(fus);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1.4), dark);
    nose.position.z = -4.2;
    g.add(nose);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.35, 2.4), mat);
    wing.position.z = -0.6;
    wing.castShadow = true;
    g.add(wing);
    const tailW = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.3, 1.4), mat);
    tailW.position.z = 3.4;
    g.add(tailW);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.8, 1.6), mat);
    fin.position.set(0, 0.9, 3.4);
    g.add(fin);
    g.scale.setScalar(S);
    g.visible = false;
    this.scene.add(g);
    return g;
  }

  _updateStrike(dt) {
    const st = this.strike;
    st.s += st.speed * dt;
    const pos = _v.copy(st.entry).addScaledVector(st.dir, st.s);
    st.plane.position.copy(pos);
    st.plane.rotation.y = -Math.atan2(st.dir.z, st.dir.x) - Math.PI / 2;
    st.plane.rotation.z = 0.08 * Math.sin(st.s * 0.08);
    st.engine?.setThrottle(0.7);
    for (const tg of st.targets) {
      if (!tg.dropped && st.s >= tg.sRelease) {
        tg.dropped = true;
        st.bombs.push({
          p: new THREE.Vector3(pos.x, pos.y - 1.2 * S, pos.z),
          v: new THREE.Vector3(st.dir.x * st.speed * 0.92, 0, st.dir.z * st.speed * 0.92),
          mesh: this._bombMesh(),
        });
        this.game.sfx.whistle(1.3);
      }
    }
    for (let i = st.bombs.length - 1; i >= 0; i--) {
      const b = st.bombs[i];
      const speed = b.v.length();
      const sub = Math.max(1, Math.ceil((speed * dt) / 0.3));
      const h = dt / sub;
      let hit = false;
      for (let k = 0; k < sub; k++) {
        b.v.y -= G * h;
        b.p.addScaledVector(b.v, h);
        if (b.p.y <= 0.3 || this.game.world.occupiedAt(b.p)) { hit = true; break; }
      }
      if (hit) {
        const at = b.p.clone();
        at.y = Math.max(0.4, at.y);
        this.scene.remove(b.mesh);
        st.bombs.splice(i, 1);
        this.game.explode(at, 4.8 * S, this.game.state.player, 2.6);
      } else {
        b.mesh.position.copy(b.p);
        b.mesh.rotation.x += dt * 2;
      }
    }
    if (st.s >= st.exitS && st.bombs.length === 0) {
      st.phase = 'idle';
      st.plane.visible = false;
      st.engine?.stop();
      st.engine = null;
    }
  }

  _bombMesh() {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.22, 1.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x33413a, roughness: 0.5, metalness: 0.4 })
    );
    m.rotation.x = Math.PI / 2;
    m.castShadow = true;
    this.scene.add(m);
    return m;
  }

  // ================= BULLDOZER =================
  deployDozer() {
    const dz = this.dozer;
    if (dz.active || this.busy) return false;
    if (!this.game.spend(COSTS.dozer)) return false;
    if (dz.mesh) { this.scene.remove(dz.mesh); dz.mesh = null; }
    dz.mesh = this._buildDozer();
    dz.mesh.scale.setScalar(S);
    dz.pos.set(-16 * S, 0, 38 * S);
    dz.yaw = 0;
    dz.spd = 0;
    dz.t = 15;
    dz.active = true;
    dz.input.f = 0; dz.input.s = 0;
    dz.engine = this.game.sfx.engineStart('dozer');
    return true;
  }

  _buildDozer() {
    const g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: 0xc9742e, roughness: 0.6, metalness: 0.2 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a352f, roughness: 0.8 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.4, metalness: 0.6 });
    const tr1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 4.6), dark);
    tr1.position.set(-1.5, 0.6, 0); tr1.castShadow = true; g.add(tr1);
    const tr2 = tr1.clone(); tr2.position.x = 1.5; g.add(tr2);
    const bd = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.4, 3.8), body);
    bd.position.y = 1.85; bd.castShadow = true; g.add(bd);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.4, 1.8), body);
    cab.position.set(0, 3.1, 0.7); cab.castShadow = true; g.add(cab);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 0.15), new THREE.MeshStandardMaterial({ color: 0xffd98a, roughness: 0.2 }));
    glass.position.set(0, 3.2, -0.25); g.add(glass);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.2, 8), dark);
    pipe.position.set(0.8, 3.1, -1.2); g.add(pipe);
    const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 2.4), steel);
    arm1.position.set(-1.6, 1.4, -1.6); g.add(arm1);
    const arm2 = arm1.clone(); arm2.position.x = 1.6; g.add(arm2);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2, 0.5), steel);
    blade.position.set(0, 1.25, -3);
    blade.rotation.x = 0.12;
    blade.castShadow = true;
    g.add(blade);
    this.scene.add(g);
    return g;
  }

  _updateDozer(dt) {
    const dz = this.dozer;
    dz.t -= dt;
    if (dz.t <= 0) {
      dz.active = false;
      dz.engine?.stop();
      dz.engine = null;
      this.game.physics.spawnDust(dz.pos, 6, { spread: 2, up: 2, out: 2, scale: 1 });
      return;
    }
    const target = dz.input.f >= 0 ? dz.input.f * 9.5 * S : dz.input.f * 4.5 * S;
    dz.spd += (target - dz.spd) * Math.min(1, dt * 3.5);
    dz.yaw -= dz.input.s * 1.7 * dt;
    const fwd = _v2.set(-Math.sin(dz.yaw), 0, -Math.cos(dz.yaw));
    // destruction OBB in front
    if (Math.abs(dz.spd) > 0.4 * S) {
      const c = dz.pos.clone().addScaledVector(fwd, 1.4 * S);
      c.y = 1.7 * S;
      const destroyed = this.game.world.destroyOBB(
        this.game, this.game.state.player, c,
        _v.set(2.8 * S, 1.9 * S, 3.2 * S), dz.yaw, fwd
      );
      if (destroyed > 0) {
        dz.spd *= Math.max(0.4, 1 - destroyed * 0.06);
        this.game.shake(Math.min(0.25, destroyed * 0.02));
        this.game.physics.spawnDust(c.clone().addScaledVector(fwd, 1.6 * S), Math.min(5, destroyed), { spread: 2.4, up: 3, out: 3, scale: 1 });
        if (Math.random() < 0.3) this.game.sfx.rumble(0.3);
      }
    }
    dz.pos.addScaledVector(fwd, dz.spd * dt);
    dz.pos.x = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, dz.pos.x));
    dz.pos.z = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, dz.pos.z));
    dz.mesh.position.copy(dz.pos);
    dz.mesh.rotation.y = dz.yaw;
    dz.engine?.setThrottle(Math.abs(dz.spd) / (9.5 * S));
    dz.puffT += dt;
    if (dz.puffT > 0.3 && Math.abs(dz.spd) > 1 * S) {
      dz.puffT = 0;
      const ex = dz.pos.clone().addScaledVector(fwd, -1 * S).add(_v.set(0.8 * S, 3.6 * S, 0));
      this.game.physics.spawnDust(ex, 1, { spread: 0.2, up: 2.5, out: 0.3, scale: 0.4 });
    }
  }

  removeDozer() {
    const dz = this.dozer;
    if (dz.engine) { dz.engine.stop(); dz.engine = null; }
    dz.active = false;
    if (dz.mesh) { this.scene.remove(dz.mesh); dz.mesh = null; }
  }

  // ================= per-frame =================
  update(dt) {
    if (this.mode === 'mortar' && !this.shell) this._updatePreview();
    if (this.shell) this._updateShell(dt);
    if (this.strike.phase === 'run') this._updateStrike(dt);
    if (this.dozer.active) this._updateDozer(dt);
  }
}
