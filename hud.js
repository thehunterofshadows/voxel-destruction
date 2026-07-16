// hud.js — DOM overlay: dock, panels, overlays, popups, joystick
import { COSTS } from './weapons.js';

const CSS = `
.vg-hud{position:absolute;inset:0;pointer-events:none;font-family:Rubik,system-ui,sans-serif;color:#fff2e0;
  --panel:rgba(26,14,34,.82);--accent:#ffb36b;--danger:#ff6b57;user-select:none;-webkit-user-select:none;z-index:5;overflow:hidden}
.vg-hud *{box-sizing:border-box}
.vg-hud button{font-family:inherit;pointer-events:auto;cursor:pointer;border:none;color:#fff2e0}
.vg-top{position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:96%}
.vg-pill{background:var(--panel);backdrop-filter:blur(6px);border:1px solid rgba(255,179,107,.25);border-radius:999px;
  padding:7px 14px;font-size:13px;font-weight:600;letter-spacing:.03em;white-space:nowrap;display:flex;gap:7px;align-items:center}
.vg-chip{display:flex;gap:6px;align-items:center;background:var(--panel);border:1px solid rgba(255,255,255,.12);
  border-radius:999px;padding:6px 11px;font-size:12.5px;font-weight:600;transition:box-shadow .2s,border-color .2s}
.vg-chip .dot{width:9px;height:9px;border-radius:50%}
.vg-chip.on{border-color:var(--accent);box-shadow:0 0 0 2px rgba(255,179,107,.35)}
.vg-cash{font-weight:700;color:#ffe9b8}
.vg-cash.flash{animation:vgflash .5s}
@keyframes vgflash{0%,100%{color:#ffe9b8}40%{color:var(--danger);transform:scale(1.15)}}
.vg-cam{position:absolute;right:10px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px}
.vg-cam button{width:44px;height:44px;border-radius:12px;background:var(--panel);border:1px solid rgba(255,179,107,.25);
  font-size:20px;line-height:1;backdrop-filter:blur(6px)}
.vg-cam button:active{background:rgba(255,179,107,.3)}
.vg-dock{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);display:flex;gap:8px;align-items:stretch;pointer-events:none}
.vg-wbtn{pointer-events:auto;background:var(--panel);backdrop-filter:blur(6px);border:2px solid rgba(255,255,255,.14);border-radius:14px;
  padding:8px 12px 7px;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:76px;min-height:56px;transition:border-color .15s, transform .1s}
.vg-wbtn .nm{font-size:12.5px;font-weight:700;letter-spacing:.04em}
.vg-wbtn .cost{font-size:11px;color:#d9b88f;font-weight:600}
.vg-wbtn.sel{border-color:var(--accent);background:rgba(80,40,30,.85)}
.vg-wbtn:disabled{opacity:.4;cursor:default}
.vg-wbtn .ic{width:18px;height:14px;position:relative;margin-bottom:1px}
.ic-mortar::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:11px;height:11px;border-radius:50%;background:#ffd98a}
.ic-strike::after{content:"";position:absolute;left:50%;top:2px;transform:translateX(-50%);
  border-left:8px solid transparent;border-right:8px solid transparent;border-top:11px solid #ffd98a}
.ic-dozer::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:14px;height:10px;background:#ffd98a;border-radius:2px}
.vg-done{pointer-events:auto;background:linear-gradient(180deg,#8e3b2c,#6e2a20);border:2px solid rgba(255,140,90,.5);border-radius:14px;
  padding:8px 16px;font-family:Bungee,Rubik,sans-serif;font-size:14px;letter-spacing:.05em}
.vg-done:disabled{opacity:.4}
.vg-panel{position:absolute;left:50%;bottom:84px;transform:translateX(-50%);width:min(480px,94%);
  background:var(--panel);backdrop-filter:blur(8px);border:1px solid rgba(255,179,107,.25);border-radius:16px;
  padding:12px 14px;pointer-events:auto;display:none}
.vg-panel.show{display:block}
.vg-fire{width:100%;margin-top:8px;padding:12px;border-radius:12px;font-family:Bungee,Rubik,sans-serif;font-size:16px;letter-spacing:.06em;
  background:linear-gradient(180deg,#d4552f,#a13a20);border:2px solid rgba(255,170,110,.6);box-shadow:0 4px 18px rgba(212,85,47,.4)}
.vg-fire:active{transform:translateY(1px)}
.vg-fire:disabled{opacity:.45;box-shadow:none}
.vg-hint{font-size:13px;line-height:1.45;color:#f4dcb8;text-align:center;padding:2px 0 4px}
.vg-btnrow{display:flex;gap:8px;margin-top:8px}
.vg-btnrow button{flex:1;padding:11px;border-radius:12px;font-weight:700;font-size:13.5px}
.vg-confirm{background:linear-gradient(180deg,#d4552f,#a13a20);border:2px solid rgba(255,170,110,.6);font-family:Bungee,Rubik,sans-serif;letter-spacing:.05em}
.vg-cancel{background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.2)}
.vg-timer{height:8px;border-radius:99px;background:rgba(255,255,255,.14);overflow:hidden;margin-top:8px}
.vg-timer i{display:block;height:100%;background:linear-gradient(90deg,#ffb36b,#ff6b57);border-radius:99px}
.vg-joy{position:absolute;left:18px;bottom:100px;width:124px;height:124px;border-radius:50%;
  background:rgba(26,14,34,.55);border:2px solid rgba(255,179,107,.35);pointer-events:auto;display:none;touch-action:none}
.vg-joy.show{display:block}
.vg-joy .knob{position:absolute;left:50%;top:50%;width:52px;height:52px;border-radius:50%;
  background:rgba(255,179,107,.85);transform:translate(-50%,-50%);box-shadow:0 2px 10px rgba(0,0,0,.4)}
.vg-pop{position:absolute;transform:translate(-50%,-50%);font-family:Bungee,Rubik,sans-serif;font-size:17px;
  text-shadow:0 2px 6px rgba(0,0,0,.55);animation:vgpop 1.15s ease-out forwards;white-space:nowrap;pointer-events:none}
.vg-pop.big{font-size:23px;color:#ffd98a}
@keyframes vgpop{0%{opacity:0;margin-top:6px}12%{opacity:1}75%{opacity:1;margin-top:-34px}100%{opacity:0;margin-top:-52px}}
.vg-toast{position:absolute;top:64px;left:50%;transform:translateX(-50%);background:var(--panel);border:1px solid rgba(255,179,107,.4);
  border-radius:12px;padding:10px 18px;font-weight:700;font-size:14px;opacity:0;transition:opacity .25s;white-space:nowrap}
.vg-toast.show{opacity:1}
.vg-overlay{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%,rgba(46,22,58,.82),rgba(18,8,24,.94));
  display:none;align-items:center;justify-content:center;pointer-events:auto;z-index:10}
.vg-overlay.show{display:flex}
.vg-card{text-align:center;padding:28px 30px;max-width:min(480px,92%);width:100%}
.vg-title{font-family:Bungee,Rubik,sans-serif;font-size:clamp(30px,7vw,52px);line-height:1.05;color:#ffb36b;
  text-shadow:0 4px 0 rgba(110,42,32,.9),0 10px 34px rgba(255,107,87,.35);margin:0 0 6px}
.vg-sub{font-size:14.5px;color:#e8c9a0;line-height:1.55;margin:8px 0}
.vg-mappill{display:inline-block;background:rgba(255,179,107,.15);border:1px solid rgba(255,179,107,.45);
  border-radius:999px;padding:7px 18px;font-weight:700;font-size:14px;color:#ffd98a;margin:6px 0 2px;letter-spacing:.04em}
.vg-big{display:inline-block;margin-top:16px;padding:14px 34px;border-radius:14px;font-family:Bungee,Rubik,sans-serif;font-size:17px;letter-spacing:.06em;
  background:linear-gradient(180deg,#d4552f,#a13a20);border:2px solid rgba(255,170,110,.6);box-shadow:0 6px 26px rgba(212,85,47,.5)}
.vg-big:active{transform:translateY(1px)}
.vg-pname{font-family:Bungee,Rubik,sans-serif;font-size:clamp(26px,6vw,40px);margin:4px 0}
.vg-stand{margin:14px auto 0;max-width:340px;text-align:left;display:flex;flex-direction:column;gap:7px}
.vg-srow2{display:grid;grid-template-columns:16px 1fr auto;gap:9px;align-items:center;font-size:14px;font-weight:600}
.vg-srow2 .dot{width:11px;height:11px;border-radius:50%}
.vg-srow2 .bar{position:relative;height:20px;border-radius:7px;background:rgba(255,255,255,.09);overflow:hidden}
.vg-srow2 .bar i{position:absolute;inset:0 auto 0 0;border-radius:7px;opacity:.75}
.vg-srow2 .bar span{position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:12px;font-weight:700}
.vg-srow2 .sc{font-family:Bungee,Rubik,sans-serif;font-size:14px}
.vg-costs{display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap}
.vg-costs span{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:6px 11px;font-size:12px;font-weight:600}
.vg-keys{position:absolute;left:12px;bottom:12px;font-size:11px;color:rgba(244,220,184,.65);line-height:1.5;pointer-events:none}
@media (hover:none){.vg-keys{display:none}}
@media (max-width:560px){
  .vg-wbtn{min-width:64px;padding:7px 8px 6px}
  .vg-panel{bottom:80px}
  .vg-cam button{width:40px;height:40px}
}
.vg-settings-btn{position:absolute;left:10px;top:10px;width:44px;height:44px;border-radius:12px;
  background:var(--panel);border:1px solid rgba(255,179,107,.25);font-size:20px;line-height:1;
  backdrop-filter:blur(6px);pointer-events:auto;display:flex;align-items:center;justify-content:center}
.vg-settings-btn:active{background:rgba(255,179,107,.3)}
.vg-settings-panel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(340px,90%);
  background:var(--panel);backdrop-filter:blur(10px);border:2px solid rgba(255,179,107,.4);border-radius:16px;
  padding:18px;pointer-events:auto;display:none;z-index:15}
.vg-settings-panel.show{display:block}
.vg-settings-title{font-family:Bungee,Rubik,sans-serif;font-size:16px;color:var(--accent);margin:0 0 12px;text-align:center;letter-spacing:.05em}
.vg-settings-row{display:flex;justify-content:space-between;align-items:center;margin:12px 0}
.vg-settings-row label{font-size:12.5px;font-weight:600;color:#f4dcb8}
.vg-switch{position:relative;display:inline-block;width:42px;height:22px}
.vg-switch input{opacity:0;width:0;height:0}
.vg-slider{position:absolute;cursor:pointer;inset:0;background-color:rgba(255,255,255,0.18);border-radius:34px;transition:.2s}
.vg-slider:before{position:absolute;content:"";height:16px;width:16px;left:3px;bottom:3px;background-color:#fff;border-radius:50%;transition:.2s}
.vg-switch input:checked + .vg-slider{background-color:var(--accent)}
.vg-switch input:checked + .vg-slider:before{transform:translateX(20px)}
.vg-settings-close{width:100%;margin-top:14px;padding:9px;border-radius:10px;font-weight:700;font-size:13px;
  background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2)}
.vg-settings-close:active{background:rgba(255,255,255,0.2)}
`;

export class HUD {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.joy = { active: false, f: 0, s: 0 };
    this._lastPop = null;
    this._sig = '';
    root.innerHTML = `
<style>${CSS}</style>
<div class="vg-hud">
  <div class="vg-top">
    <div class="vg-pill" data-round>ROUND 1/3</div>
    <div data-chips style="display:flex;gap:6px"></div>
    <div class="vg-pill">SPENT <span class="vg-cash" data-cash>$0</span></div>
  </div>
  <div class="vg-cam">
    <button data-rotl title="Rotate left">&#8634;</button>
    <button data-rotr title="Rotate right">&#8635;</button>
    <button data-zin title="Zoom in">+</button>
    <button data-zout title="Zoom out">&minus;</button>
  </div>
  <div class="vg-panel" data-panel-mortar>
    <button class="vg-fire" data-fire>FIRE &mdash; $300</button>
  </div>
  <div class="vg-panel" data-panel-strike>
    <div class="vg-hint" data-strike-hint>Drag a line across the map &mdash; the bomber flies it and lays a stick of bombs.</div>
    <div class="vg-btnrow" data-strike-btns style="display:none">
      <button class="vg-cancel" data-strike-cancel>Cancel</button>
      <button class="vg-confirm" data-strike-go>CALL IT IN &mdash; $1000</button>
    </div>
  </div>
  <div class="vg-panel" data-panel-dozer>
    <div data-dozer-idle>
      <div class="vg-hint">15 seconds at the controls. Plow through anything.</div>
      <button class="vg-fire" data-deploy>ROLL OUT &mdash; $300</button>
    </div>
    <div data-dozer-live style="display:none">
      <div class="vg-hint" data-dozer-hint>Joystick or WASD / arrows to drive</div>
      <div class="vg-timer"><i data-dozer-bar style="width:100%"></i></div>
    </div>
  </div>
  <div class="vg-dock">
    <button class="vg-wbtn" data-w="mortar"><span class="ic ic-mortar"></span><span class="nm">MORTAR</span><span class="cost">$300</span></button>
    <button class="vg-wbtn" data-w="strike"><span class="ic ic-strike"></span><span class="nm">AIRSTRIKE</span><span class="cost">$1000</span></button>
    <button class="vg-wbtn" data-w="dozer"><span class="ic ic-dozer"></span><span class="nm">DOZER</span><span class="cost">$300</span></button>
    <button class="vg-done" data-done>DONE</button>
  </div>
  <div class="vg-joy" data-joy><div class="knob" data-knob></div></div>
  <div class="vg-keys">1/2/3 weapons &middot; SPACE fire &middot; Q/E rotate &middot; scroll zoom</div>
  <div data-pops></div>
  <div class="vg-toast" data-toast></div>
  <div class="vg-overlay" data-overlay><div class="vg-card" data-card></div></div>
  <button class="vg-settings-btn" data-settings-btn title="Graphics Settings">&#9881;</button>
  <div class="vg-settings-panel" data-settings-panel>
    <div class="vg-settings-title">GRAPHICS CONFIG</div>
    <div class="vg-settings-row">
      <label>Soft Voxel Edges</label>
      <label class="vg-switch"><input type="checkbox" data-set-soft-edges><span class="vg-slider"></span></label>
    </div>
    <div class="vg-settings-row">
      <label>Geometric Bevels (Slow)</label>
      <label class="vg-switch"><input type="checkbox" data-set-bevels><span class="vg-slider"></span></label>
    </div>
    <div class="vg-settings-row">
      <label>Ambient Occlusion</label>
      <label class="vg-switch"><input type="checkbox" data-set-ao><span class="vg-slider"></span></label>
    </div>
    <div class="vg-settings-row">
      <label>Bloom Glow</label>
      <label class="vg-switch"><input type="checkbox" data-set-bloom><span class="vg-slider"></span></label>
    </div>
    <div class="vg-settings-row">
      <label>Dynamic Shadows</label>
      <label class="vg-switch"><input type="checkbox" data-set-shadows><span class="vg-slider"></span></label>
    </div>
    <div class="vg-settings-row">
      <label>Density Particles</label>
      <label class="vg-switch"><input type="checkbox" data-set-gpu><span class="vg-slider"></span></label>
    </div>
    <div class="vg-hint" style="font-size:10px;margin-top:10px;opacity:0.8">Note: Edge effects, AO, and bloom require starting a new map or reloading.</div>
    <button class="vg-settings-close" data-settings-close>CLOSE</button>
  </div>
</div>`;
    this.el = {};
    for (const n of root.querySelectorAll('[data-round],[data-chips],[data-cash],[data-pops],[data-toast],[data-overlay],[data-card],[data-joy],[data-knob],[data-settings-btn],[data-settings-panel],[data-set-soft-edges],[data-set-bevels],[data-set-ao],[data-set-bloom],[data-set-shadows],[data-set-gpu],[data-settings-close]')) {
      for (const a of n.attributes) {
        if (!a.name.startsWith('data-')) continue;
        const key = a.name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
        this.el[key] = n;
      }
    }
    const $ = (s) => root.querySelector(s);
    Object.assign(this.el, {
      rotl: $('[data-rotl]'), rotr: $('[data-rotr]'), zin: $('[data-zin]'), zout: $('[data-zout]'),
      panelMortar: $('[data-panel-mortar]'), panelStrike: $('[data-panel-strike]'), panelDozer: $('[data-panel-dozer]'),
      fire: $('[data-fire]'), strikeHint: $('[data-strike-hint]'), strikeBtns: $('[data-strike-btns]'),
      strikeGo: $('[data-strike-go]'), strikeCancel: $('[data-strike-cancel]'),
      deploy: $('[data-deploy]'), dozerIdle: $('[data-dozer-idle]'), dozerLive: $('[data-dozer-live]'),
      dozerBar: $('[data-dozer-bar]'), done: $('[data-done]'),
      wbtns: [...root.querySelectorAll('.vg-wbtn')],
    });
    this._chips();
    this._bind();
  }

  _chips() {
    this.el.chips.innerHTML = this.game.players.map((p, i) =>
      `<div class="vg-chip" data-ch="${i}"><span class="dot" style="background:${p.color}"></span><span>P${i + 1}</span><b data-sc="${i}">0</b></div>`
    ).join('');
  }

  _bind() {
    const g = this.game;
    const w = () => g.weapons;
    this.el.rotl.onclick = () => { g.sfx.click(); g.rotateCam(1); };
    this.el.rotr.onclick = () => { g.sfx.click(); g.rotateCam(-1); };
    this.el.zin.onclick = () => g.zoomCam(0.8);
    this.el.zout.onclick = () => g.zoomCam(1.25);
    for (const b of this.el.wbtns) {
      b.onclick = () => { g.sfx.click(); g.selectWeapon(b.dataset.w); };
    }
    this.el.done.onclick = () => { g.sfx.click(); g.endTurnRequest(); };
    this.el.fire.onclick = () => w().fireMortar();
    this.el.strikeGo.onclick = () => w().confirmStrike();
    this.el.strikeCancel.onclick = () => { w().cancelStrike(); };
    this.el.deploy.onclick = () => w().deployDozer();
    // joystick
    const joy = this.el.joy, knob = this.el.knob;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
    joy.addEventListener('pointerdown', (e) => {
      joy.setPointerCapture(e.pointerId);
      this.joy.active = true;
      this._joyMove(e, setKnob);
      e.preventDefault();
    });
    joy.addEventListener('pointermove', (e) => { if (this.joy.active) this._joyMove(e, setKnob); });
    const end = () => { this.joy.active = false; this.joy.f = 0; this.joy.s = 0; setKnob(0, 0); };
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);

    // Settings menu bindings
    this.el.settingsBtn.onclick = () => {
      g.sfx.click();
      const s = g.graphicsSettings || {};
      this.el.setSoftEdges.checked = s.softVoxelEdges === true;
      this.el.setBevels.checked = s.bevelledVoxels !== false;
      this.el.setAo.checked = s.ambientOcclusion !== false;
      this.el.setBloom.checked = s.bloom !== false;
      this.el.setShadows.checked = s.dynamicShadows !== false;
      this.el.setGpu.checked = !!s.gpuParticles;
      this.el.settingsPanel.classList.add('show');
    };

    this.el.settingsClose.onclick = () => {
      g.sfx.click();
      this.el.settingsPanel.classList.remove('show');
    };

    const updateSetting = (key, checkbox, label) => {
      g.sfx.click();
      g.graphicsSettings[key] = checkbox.checked;

      if (checkbox.checked && key === 'softVoxelEdges') {
        g.graphicsSettings.bevelledVoxels = false;
        this.el.setBevels.checked = false;
      } else if (checkbox.checked && key === 'bevelledVoxels') {
        g.graphicsSettings.softVoxelEdges = false;
        this.el.setSoftEdges.checked = false;
      }

      g.saveGraphicsSettings();
      
      if (key === 'bloom') {
        if (!checkbox.checked && g.postProcessing) {
          g.postProcessing = null; // Disable rendering pass dynamically
        }
      }
      
      if (key === 'softVoxelEdges' || key === 'bevelledVoxels' || key === 'ambientOcclusion' || key === 'bloom') {
        this.toast(`${label} changed. Reload to apply.`);
      } else {
        this.toast(`${label} updated!`);
      }
    };

    this.el.setSoftEdges.onchange = () => updateSetting('softVoxelEdges', this.el.setSoftEdges, 'Soft Voxel Edges');
    this.el.setBevels.onchange = () => updateSetting('bevelledVoxels', this.el.setBevels, 'Geometric Bevels');
    this.el.setAo.onchange = () => updateSetting('ambientOcclusion', this.el.setAo, 'Ambient Occlusion');
    this.el.setBloom.onchange = () => updateSetting('bloom', this.el.setBloom, 'Bloom Glow');
    this.el.setShadows.onchange = () => updateSetting('dynamicShadows', this.el.setShadows, 'Dynamic Shadows');
    this.el.setGpu.onchange = () => updateSetting('gpuParticles', this.el.setGpu, 'Density Particles');
  }

  _joyMove(e, setKnob) {
    const r = this.el.joy.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const m = Math.hypot(dx, dy), max = r.width / 2 - 14;
    if (m > max) { dx = (dx / m) * max; dy = (dy / m) * max; }
    setKnob(dx, dy);
    this.joy.s = dx / max;
    this.joy.f = -dy / max;
  }

  setWeapon(m) {
    for (const b of this.el.wbtns) b.classList.toggle('sel', b.dataset.w === m);
    this.el.panelMortar.classList.toggle('show', m === 'mortar');
    this.el.panelStrike.classList.toggle('show', m === 'strike');
    this.el.panelDozer.classList.toggle('show', m === 'dozer');
  }

  refreshScores() {
    this.game.players.forEach((p, i) => {
      const el = this.root.querySelector(`[data-sc="${i}"]`);
      if (el) el.textContent = Math.round(p.score);
    });
  }

  refreshCash() {
    this.el.cash.textContent = '$' + this.game.state.spent;
  }

  flashCash() {
    this.el.cash.classList.remove('flash');
    void this.el.cash.offsetWidth;
    this.el.cash.classList.add('flash');
  }

  refreshTurn() {
    const s = this.game.state;
    this.el.round.textContent = `ROUND ${s.round}/${this.game.cfg.rounds}`;
    this.root.querySelectorAll('.vg-chip').forEach((c, i) => c.classList.toggle('on', i === s.player));
    this.refreshCash();
    this.refreshScores();
  }

  popupWorld(pos, text, cls = 'pts', color = '#ffe9b8', val = 0) {
    const sp = this.game.worldToScreen(pos);
    if (!sp) return;
    const now = performance.now();
    if (cls === 'tick' && this._lastPop && now - this._lastPop.t0 < 450 && this._lastPop.el.isConnected) {
      this._lastPop.val += val;
      this._lastPop.el.textContent = '+' + Math.round(this._lastPop.val);
      return;
    }
    const el = document.createElement('div');
    el.className = 'vg-pop' + (cls === 'big' ? ' big' : '');
    el.style.left = sp.x + 'px';
    el.style.top = sp.y + 'px';
    if (cls !== 'big') el.style.color = color;
    el.textContent = text;
    this.el.pops.appendChild(el);
    if (cls === 'tick') this._lastPop = { el, val, t0: now };
    setTimeout(() => el.remove(), 1200);
  }

  toast(text, ms = 1600) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.el.toast.classList.remove('show'), ms);
  }

  // ---------- overlays ----------
  _overlay(html, clickAll, cb) {
    const ov = this.el.overlay;
    this.el.card.innerHTML = html;
    ov.classList.add('show');
    const done = () => { ov.classList.remove('show'); ov.onclick = null; cb && cb(); };
    if (clickAll) {
      ov.onclick = done;
    } else {
      const b = this.el.card.querySelector('[data-go]');
      if (b) b.onclick = (e) => { e.stopPropagation(); done(); };
    }
  }

  showTitle(mapName, cb) {
    this._overlay(`
      <h1 class="vg-title">VOXEL<br>WRECKERS</h1>
      <div class="vg-mappill">MAP &mdash; ${mapName}</div>
      <p class="vg-sub">4 players &middot; ${this.game.cfg.rounds} rounds each &middot; pass &amp; play<br>
      <p class="vg-sub">Wreck buildings for up to <b>1000 pts</b> each &mdash; level one completely for a <b>+500 bonus</b>.<br>
      No budget cap: every shot&rsquo;s cost comes straight off your score.</p>
      <div class="vg-costs"><span>MORTAR $300</span><span>AIRSTRIKE $1000</span><span>BULLDOZER $300</span></div>
      <button class="vg-big" data-go>START WRECKING</button>`, false, cb);
  }

  showTurnIntro(cb) {
    const s = this.game.state;
    const p = this.game.players[s.player];
    this._overlay(`
      <div class="vg-mappill">ROUND ${s.round} / ${this.game.cfg.rounds}</div>
      <div class="vg-pname" style="color:${p.color}">${p.name}</div>
      <p class="vg-sub">Pass the device. Shot costs come off your score.</p>
      <button class="vg-big" data-go>TAP TO WRECK</button>`, true, cb);
  }

  _standings(withBars) {
    const ps = this.game.players.map((p, i) => ({ ...p, i })).sort((a, b) => b.score - a.score);
    const max = Math.max(1, ps[0].score);
    return `<div class="vg-stand">` + ps.map((p) => `
      <div class="vg-srow2">
        <span class="dot" style="background:${p.color}"></span>
        <span class="bar"><i style="background:${p.color};width:${Math.max(4, (p.score / max) * 100)}%"></i>
        <span>${p.name}${p.razed ? ` &middot; ${p.razed} leveled` : ''}</span></span>
        <span class="sc">${Math.round(p.score)}</span>
      </div>`).join('') + `</div>`;
  }

  showRecap(cb) {
    const s = this.game.state;
    const dmg = Math.round(this.game.world.damagePct() * 100);
    this._overlay(`
      <h2 class="vg-title" style="font-size:clamp(24px,5vw,36px)">ROUND ${s.round} DONE</h2>
      <p class="vg-sub">Map destruction: <b>${dmg}%</b></p>
      ${this._standings()}
      <button class="vg-big" data-go>START ROUND ${s.round + 1}</button>`, false, cb);
  }

  showPodium(cb) {
    const ps = [...this.game.players].sort((a, b) => b.score - a.score);
    const dmg = Math.round(this.game.world.damagePct() * 100);
    this._overlay(`
      <div class="vg-mappill">FINAL &mdash; ${dmg}% OF ${this.game.world.mapName.toUpperCase()} DESTROYED</div>
      <h2 class="vg-title" style="font-size:clamp(24px,5vw,38px);margin-top:8px">WINNER</h2>
      <div class="vg-pname" style="color:${ps[0].color}">${ps[0].name}</div>
      ${this._standings()}
      <button class="vg-big" data-go>PLAY AGAIN &mdash; NEW MAP</button>`, false, cb);
  }

  // ---------- per-frame ----------
  update() {
    const g = this.game, w = g.weapons, s = g.state;
    const dz = w.dozer;
    const sig = [
      w.busy, w.mode, w.strike.phase, dz.active, !!w.shell,
    ].join('|');
    if (sig !== this._sig) {
      this._sig = sig;
      this.el.fire.disabled = !!w.shell;
      this.el.done.disabled = w.busy;
      this.el.deploy.disabled = w.busy;
      this.el.deploy.style.display = '';
      for (const b of this.el.wbtns) {
        b.disabled = w.busy && b.dataset.w !== w.mode;
      }
      const ph = w.strike.phase;
      this.el.strikeBtns.style.display = ph === 'pending' ? '' : 'none';
      this.el.strikeGo.disabled = false;
      this.el.strikeHint.textContent =
        ph === 'run' ? 'Bomber inbound. Heads down.' :
        ph === 'pending' ? 'Locked in? The stick lands along your line.' :
        'Drag a line across the map \u2014 the bomber flies it and lays a stick of bombs.';
      this.el.dozerIdle.style.display = dz.active ? 'none' : '';
      this.el.dozerLive.style.display = dz.active ? '' : 'none';
      this.el.joy.classList.toggle('show', dz.active);
    }
    if (dz.active) this.el.dozerBar.style.width = Math.max(0, (dz.t / 15) * 100) + '%';
  }
}
