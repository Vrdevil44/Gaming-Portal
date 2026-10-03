// Run: node test/pong.test.mjs   (Node 18+, no dependencies, no browser)
import assert from 'node:assert/strict';
import {
	createState, update, moveBall, predictY, setPlayerY, aiMaxSpeed, WIN_SCORE, PADDLE_H, PLAYER_FACE, AI_FACE, BALL_R,
	BALL_MAX_SPEED, BALL_START_SPEED, PLAYER_KEY_SPEED, AI_LAG_MS,
} from '../js/games/pong/logic.js';
import { createFrame, createStorage } from '../js/core/frame.js';
import { pongDef } from '../js/games/pong/index.js';

const consoleErrors = [];
const origError = console.error;
console.error = (...a) => { consoleErrors.push(a); };

let failed = 0;
function check(name, fn) {
	try { fn(); console.log('PASS', name); } catch (e) { failed++; console.log('FAIL', name, '\n  ', e.message); }
}
function seq(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function memStore() {
	const m = new Map();
	return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}

// ---- minimal fake DOM / window ----
function makeEnv({ storage } = {}) {
	const targets = [];
	function target(extra = {}) {
		const t = {
			_l: [],
			addEventListener(type, fn, o) { t._l.push({ type, fn, o }); },
			removeEventListener(type, fn) { t._l = t._l.filter((x) => !(x.type === type && x.fn === fn)); },
			fire(type, ev = {}) { t._l.filter((x) => x.type === type).forEach((x) => x.fn(ev)); },
			...extra,
		};
		targets.push(t);
		return t;
	}
	const ctx2d = new Proxy({}, { get: () => () => {}, set: () => true });
	const doc = target({ hidden: false, activeElement: null });
	doc.createElement = () => {
		const c = target({ style: {}, attrs: {}, parentNode: null, ownerDocument: doc, getContext: () => ctx2d,
			getBoundingClientRect: () => ({ top: 0, height: 400 }), setAttribute(k, v) { c.attrs[k] = v; } });
		return c;
	};
	const panel = target({ clientWidth: 400, clientHeight: 400, contains: (n) => n === panel, focus() { doc.activeElement = panel; },
		appendChild(c) { c.parentNode = panel; }, removeChild(c) { c.parentNode = null; } });
	let rafCb = null; let rafId = 0;
	const win = target({
		document: doc, devicePixelRatio: 2, performance: { now: () => 0 }, localStorage: storage,
		matchMedia: () => ({ matches: false }),
		requestAnimationFrame(cb) { rafCb = cb; return ++rafId; },
		cancelAnimationFrame() { rafCb = null; },
	});
	return { win, doc, panel, raf: (t) => { const cb = rafCb; rafCb = null; if (cb) cb(t); }, hasRaf: () => rafCb !== null, targets };
}

// ---- 1. no tunnelling ----
check('S3.1 swept collision: max-speed ball never skips a paddle (huge dt, many angles)', () => {
	for (let i = 0; i < 2000; i++) {
		const r = seq(i + 3);
		const s = createState(r);
		s.serveMs = 0;
		const ang = (r() - 0.5) * 2 * (Math.PI / 3);
		const dirX = r() < 0.5 ? -1 : 1;
		const vx = dirX * BALL_MAX_SPEED * Math.cos(ang);
		const vy = BALL_MAX_SPEED * Math.sin(ang);
		const plane = dirX < 0 ? PLAYER_FACE + BALL_R : AI_FACE - BALL_R;
		const y0 = 0.2 + r() * 0.6;
		// ball reaches the paddle plane 0.1s into a 0.2s step; the paddle sits exactly where it arrives
		s.ball = { x: plane - vx * 0.1, y: y0, vx, vy };
		s.speed = BALL_MAX_SPEED;
		const span = 1 - 2 * BALL_R;
		let y = ((y0 + vy * 0.1 - BALL_R) % (2 * span) + 2 * span) % (2 * span);
		if (y > span) y = 2 * span - y;
		y += BALL_R;
		const py = Math.min(1 - PADDLE_H / 2, Math.max(PADDLE_H / 2, y));
		if (dirX < 0) s.playerY = py; else s.aiY = py;
		const before = s.playerScore + s.aiScore;
		moveBall(s, 0.2); // 0.3 court widths in one step
		assert.equal(s.playerScore + s.aiScore, before, `ball tunnelled through paddle (case ${i})`);
		assert.ok(s.hits >= 1, 'no paddle contact registered');
	}
});
check('S3.1b ball always bounces off a paddle it reaches, never ends beyond the paddle plane', () => {
	const s = createState(seq(1)); s.serveMs = 0; s.playerY = 0.5;
	s.ball = { x: PLAYER_FACE + 0.001, y: 0.5, vx: -BALL_MAX_SPEED, vy: 0 };
	s.speed = BALL_MAX_SPEED;
	moveBall(s, 1 / 60);
	assert.ok(s.ball.vx > 0 && s.ball.x > PLAYER_FACE);
});
check('S3.1c miss scores a point; first to 7 wins and stops', () => {
	const s = createState(seq(2));
	for (let i = 0; i < 20000 && !s.over; i++) { s.playerY = 0.0; update(s, 1000 / 60); }
	assert.equal(s.over, true);
	assert.equal(Math.max(s.playerScore, s.aiScore), WIN_SCORE);
	assert.ok(s.winner === 'player' || s.winner === 'ai');
	const snap = JSON.stringify([s.playerScore, s.aiScore]);
	update(s, 1000); assert.equal(JSON.stringify([s.playerScore, s.aiScore]), snap);
});
check('S3.1d ball speeds up per rally, capped, resets on point', () => {
	const s = createState(seq(4)); s.serveMs = 0;
	const speeds = [];
	for (let i = 0; i < 6; i++) {
		s.ball = { x: PLAYER_FACE + BALL_R + 0.01, y: 0.5, vx: -0.5, vy: 0 }; s.playerY = 0.5;
		moveBall(s, 0.1); speeds.push(s.speed);
	}
	for (let i = 1; i < speeds.length; i++) assert.ok(speeds[i] > speeds[i - 1]);
	assert.ok(Math.max(...speeds) <= BALL_MAX_SPEED);
	assert.ok(speeds[0] > BALL_START_SPEED);
});
check('S3.1e determinism: same rng -> same match', () => {
	const run = (seed) => {
		const s = createState(seq(seed)); const out = [];
		for (let i = 0; i < 3000 && !s.over; i++) { setPlayerY(s, s.ball.y); update(s, 1000 / 60); out.push(s.ball.x.toFixed(4), s.aiY.toFixed(4)); }
		return out.join();
	};
	assert.equal(run(9), run(9));
	assert.notEqual(run(9), run(10));
});

// ---- 2. AI beatable ----
function playMatch(seed, botSpeed) {
	const s = createState(seq(seed));
	const rnd = seq(seed * 7 + 1);
	let aimSign = 1; let lastHits = 0;
	for (let i = 0; i < 200000 && !s.over; i++) {
		// strong bot: perfect lookahead, but limited to the human key speed
		let target = 0.5;
		if (s.ball.vx < 0) {
			const mirrored = predictY({ ...s.ball, x: 1 - s.ball.x, vx: -s.ball.vx });
			// aim: hit with the paddle edge (alternating sides) to angle the return
			target = mirrored - aimSign * 0.7 * (PADDLE_H / 2);
		}
		if (s.hits !== lastHits) { lastHits = s.hits; aimSign = rnd() < 0.5 ? -1 : 1; }
		const maxMove = botSpeed * (1000 / 60) / 1000;
		setPlayerY(s, s.playerY + Math.max(-maxMove, Math.min(maxMove, target - s.playerY)));
		update(s, 1000 / 60);
	}
	assert.ok(s.over, 'match did not finish');
	return s.winner;
}
check('S3.2 AI paddle speed strictly below ball speed; lag in 120-200ms', () => {
	assert.ok(aiMaxSpeed(BALL_START_SPEED) < BALL_START_SPEED);
	assert.ok(aiMaxSpeed(BALL_MAX_SPEED) < BALL_MAX_SPEED);
	assert.deepEqual(AI_LAG_MS, [120, 200]);
	const s = createState(seq(8)); s.serveMs = 0;
	const gaps = []; let prev = s.aiTimerMs; let t = 0;
	for (let i = 0; i < 600; i++) {
		s.ball = { x: 0.5, y: 0.5, vx: 0.1, vy: 0.1 }; // keep rally alive
		const before = s.aiTimerMs; update(s, 1000 / 60); t += 1000 / 60;
		if (s.aiTimerMs > before) gaps.push(s.aiTimerMs);
	}
	assert.ok(gaps.length > 5);
	for (const g of gaps) assert.ok(g >= 120 - 1e-6 && g <= 200 + 1e-6, `lag ${g}`);
});
check('S3.2b AI win rate vs strong bot < 90% (300 seeded matches)', () => {
	let aiWins = 0; const N = 300;
	for (let i = 0; i < N; i++) if (playMatch(i + 100, PLAYER_KEY_SPEED) === 'ai') aiWins++;
	const rate = aiWins / N;
	console.log('   AI win rate vs strong bot:', (rate * 100).toFixed(1) + '%');
	assert.ok(rate < 0.9, `AI win rate ${rate}`);
});

// ---- 3. frame / registry / storage / crash ----
check('S3.3 destroy(): registry empty, rAF cancelled, no leftover listeners', () => {
	const env = makeEnv({ storage: memStore() });
	const frame = createFrame(pongDef, { window: env.win, document: env.doc, rng: seq(5) });
	frame.mount(env.panel); frame.start();
	assert.ok(frame.registry.size() > 0); assert.ok(env.hasRaf());
	frame.destroy();
	assert.equal(frame.registry.size(), 0);
	assert.equal(env.hasRaf(), false);
	for (const t of env.targets) assert.equal(t._l.length, 0, 'leftover listener');
	frame.destroy();
});
check('S3.3b a11y + input: role=img, controls in label, touch-action none, non-passive touch, key gating', () => {
	const env = makeEnv({ storage: memStore() });
	const frame = createFrame(pongDef, { window: env.win, document: env.doc, rng: seq(5) });
	frame.mount(env.panel);
	const c = frame.canvas;
	assert.equal(c.attrs.role, 'img');
	assert.match(c.attrs['aria-label'], /arrow keys/i);
	assert.match(c.attrs['aria-label'], /W and S/);
	assert.equal(c.style.touchAction, 'none');
	for (const type of ['touchstart', 'touchmove']) {
		const l = c._l.find((x) => x.type === type);
		assert.ok(l && l.o && l.o.passive === false, type + ' must be non-passive');
	}
	frame.start();
	let prevented = 0; const pd = () => { prevented++; };
	env.doc.activeElement = null;
	env.doc.fire('keydown', { key: 'ArrowUp', preventDefault: pd });
	assert.equal(prevented, 0);
	env.doc.activeElement = env.panel;
	env.doc.fire('keydown', { key: 'w', preventDefault: pd });
	assert.equal(prevented, 1);
	env.doc.fire('keyup', { key: 'w' });
	// touch drag moves paddle
	let tp = 0;
	c.fire('touchstart', { touches: [{ clientY: 40 }], preventDefault() { tp++; } });
	c.fire('touchmove', { touches: [{ clientY: 100 }], preventDefault() { tp++; } });
	assert.equal(tp, 2);
	frame.pause();
	c.fire('touchmove', { touches: [{ clientY: 300 }], preventDefault() { tp++; } });
	assert.equal(tp, 2, 'no preventDefault while paused');
	frame.destroy();
});
check('S3.3c full loop: match plays to game over, best stored under hideout:v1:pong:best', () => {
	const store = memStore();
	const env = makeEnv({ storage: store });
	const states = [];
	const frame = createFrame(pongDef, { window: env.win, document: env.doc, rng: seq(5), onState: (s) => states.push(s) });
	frame.mount(env.panel); frame.start();
	let t = 0;
	for (let i = 0; i < 20000 && frame.state === 'running'; i++) { t += 16; env.raf(t); }
	assert.equal(frame.state, 'over');
	assert.ok(store.m.has('hideout:v1:pong:best'));
	frame.destroy();
});
check('S3.4 storage key prefix + garbage + throwing storage RAM fallback', () => {
	const store = memStore();
	const st = createStorage('pong', store);
	assert.equal(st.key, 'hideout:v1:pong:best');
	st.setBest(5); st.setBest(2);
	assert.equal(store.m.get('hideout:v1:pong:best'), '5');
	assert.equal(createStorage('pong', { getItem: () => 'abc', setItem() {} }).getBest(), 0);
	const boom = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
	const b = createStorage('pong', boom);
	assert.equal(b.setBest(3), 3); assert.equal(b.getBest(), 3); assert.equal(b.fallback, true);
	const env = makeEnv({});
	Object.defineProperty(env.win, 'localStorage', { get() { throw new Error('SecurityError'); } });
	const frame = createFrame(pongDef, { window: env.win, document: env.doc, rng: seq(1) });
	frame.mount(env.panel); frame.start();
	assert.equal(frame.storage.getBest(), 0);
	assert.equal(frame.storage.fallback, true);
	frame.destroy();
});
check('S3.5 crash: throwing update -> destroyed, onCrash called, registry empty', () => {
	const env = makeEnv({ storage: memStore() });
	let crashed = null;
	const bad = { ...pongDef, createGame: (f) => ({ ...pongDef.createGame(f), update() { throw new Error('boom'); } }) };
	const frame = createFrame(bad, { window: env.win, document: env.doc, rng: seq(1), onCrash: (e) => { crashed = e; } });
	frame.mount(env.panel); frame.start();
	env.raf(100); env.raf(200);
	assert.equal(crashed && crashed.message, 'boom');
	assert.equal(frame.state, 'destroyed');
	assert.equal(frame.registry.size(), 0);
});

console.error = origError;
check('S3.3d zero console errors during the scripted session', () => {
	assert.deepEqual(consoleErrors, []);
});

console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
