// Run: node test/breakout.test.mjs   (Node 18+, no dependencies, no browser)
import assert from 'node:assert/strict';
import {
	createState, update, moveBall, setPaddleX, levelSpeed, LIVES, BALL_R, BALL_MAX_SPEED, PADDLE_Y, PADDLE_H, PADDLE_W,
} from '../js/games/breakout/logic.js';
import { createFrame } from '../js/core/frame.js';
import { breakoutDef } from '../js/games/breakout/index.js';

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
check('S7.1 max-speed ball never passes through bricks (incl. huge dt, many angles)', () => {
	for (let i = 0; i < 1500; i++) {
		const r = seq(i + 11);
		const s = createState(r);
		s.serveMs = 0; s.lives = 1000;
		const a = (r() - 0.5) * 2.6; // upward-ish angles
		s.ball = { x: 0.1 + r() * 0.8, y: 0.8, vx: BALL_MAX_SPEED * Math.sin(a), vy: -BALL_MAX_SPEED * Math.cos(a) };
		s.speed = BALL_MAX_SPEED;
		const total = s.bricks.length;
		const dt = [0.016, 0.1, 0.25][i % 3];
		const before = s.bricksLeft;
		moveBall(s, dt);
		// ball never ends inside a live brick
		for (const b of s.bricks) {
			if (!b.alive) continue;
			const inside = s.ball.x > b.x - BALL_R + 1e-6 && s.ball.x < b.x + b.w + BALL_R - 1e-6 &&
				s.ball.y > b.y - BALL_R + 1e-6 && s.ball.y < b.y + b.h + BALL_R - 1e-6;
			assert.ok(!inside, 'ball inside brick at i=' + i);
		}
		assert.ok(s.bricksLeft <= before && total >= s.bricksLeft);
	}
});
check('S7.1b max-speed ball descending never skips the paddle', () => {
	for (let i = 0; i < 1500; i++) {
		const r = seq(i + 5);
		const s = createState(r);
		s.serveMs = 0; s.speed = BALL_MAX_SPEED;
		s.bricks.forEach((b) => { b.alive = false; }); s.bricksLeft = 1; s.bricks[0].alive = true; // keep the level alive, brick far away top-left
		const px = 0.2 + r() * 0.6;
		setPaddleX(s, px);
		const a = (r() - 0.5) * 1.6;
		const vx = BALL_MAX_SPEED * Math.sin(a), vy = BALL_MAX_SPEED * Math.cos(a);
		const aim = px + (r() - 0.5) * PADDLE_W * 0.8; // x where the ball reaches the paddle's top face
		const tHit = 0.1 / vy; // starts 0.1 above contact
		s.ball = { x: aim - vx * tHit, y: PADDLE_Y - PADDLE_H / 2 - BALL_R - 0.1, vx, vy };
		const lives = s.lives;
		moveBall(s, 0.2); // ball travels 0.32 units: well past the paddle line in one step, too short to return
		assert.equal(s.lives, lives, 'ball tunnelled through paddle at i=' + i);
		assert.ok(s.ball.vy < 0 || s.ball.y < PADDLE_Y - PADDLE_H / 2, 'not bounced');
	}
});

// ---- 2. lives ----
check('S7.2 miss decrements lives, re-serves; game over at 0', () => {
	const s = createState(seq(1));
	assert.equal(s.lives, LIVES);
	for (let n = 1; n <= LIVES; n++) {
		s.serveMs = 0;
		setPaddleX(s, 0.9);
		s.ball = { x: 0.1, y: 0.7, vx: 0, vy: 0.6 };
		for (let k = 0; k < 600 && s.lives === LIVES - n + 1 && !s.over; k++) update(s, 16);
		assert.equal(s.lives, LIVES - n);
		assert.equal(s.over, n === LIVES);
	}
	const sc = s.score; update(s, 16); assert.equal(s.score, sc);
});

// ---- 3. level clear ----
check('S7.3 level clears when all bricks gone; ball speeds up; bricks rebuilt', () => {
	const s = createState(seq(2));
	s.serveMs = 0;
	const v1 = s.speed;
	const first = s.bricks.length;
	s.bricks.forEach((b, i) => { if (i > 0) b.alive = false; }); s.bricksLeft = 1;
	const b = s.bricks[0];
	s.ball = { x: b.x + b.w / 2, y: b.y + b.h + 0.1, vx: 0, vy: -0.6 };
	for (let k = 0; k < 200 && s.level === 1; k++) update(s, 16);
	assert.equal(s.level, 2);
	assert.equal(s.levelClears, 1);
	assert.ok(s.speed > v1 && s.speed === levelSpeed(2));
	assert.ok(s.bricksLeft > 0 && s.bricks.length > first && s.bricks.every((x) => x.alive));
	assert.ok(levelSpeed(99) <= BALL_MAX_SPEED);
});

// ---- 4. frame / registry / storage / crash ----
check('S7.4 destroy(): registry empty, rAF cancelled, no leftover listeners', () => {
	const env = makeEnv({ storage: memStore() });
	const frame = createFrame(breakoutDef, { window: env.win, document: env.doc, rng: seq(5) });
	frame.mount(env.panel); frame.start();
	assert.ok(frame.registry.size() > 0); assert.ok(env.hasRaf());
	frame.destroy();
	assert.equal(frame.registry.size(), 0);
	assert.equal(env.hasRaf(), false);
	for (const t of env.targets) assert.equal(t._l.length, 0, 'leftover listener');
	frame.destroy();
});
check('S7.5 a11y + input: role=img, label, touch-action none, non-passive touch, drag + keys', () => {
	const env = makeEnv({ storage: memStore() });
	const frame = createFrame(breakoutDef, { window: env.win, document: env.doc, rng: seq(5) });
	frame.mount(env.panel);
	const c = frame.canvas;
	assert.equal(c.attrs.role, 'img');
	assert.match(c.attrs['aria-label'], /A and D/);
	assert.equal(c.style.touchAction, 'none');
	for (const type of ['touchstart', 'touchmove']) assert.equal(c._l.find((x) => x.type === type).o.passive, false);
	frame.start();
	let prevented = 0;
	c.fire('touchstart', { touches: [{ clientX: 40 }], preventDefault() { prevented++; } });
	c.fire('touchmove', { touches: [{ clientX: 360 }], preventDefault() { prevented++; } });
	assert.equal(prevented, 2);
	env.doc.fire('keydown', { key: 'ArrowLeft', preventDefault() {} });
	frame.destroy();
});
check('S7.6 storage: key hideout:v1:breakout:best; throwing storage -> RAM fallback', () => {
	const store = memStore();
	const f1 = createFrame(breakoutDef, { window: makeEnv().win, document: makeEnv().doc, storage: store });
	assert.equal(f1.storage.key, 'hideout:v1:breakout:best');
	f1.storage.setBest(120); assert.equal(store.m.get('hideout:v1:breakout:best'), '120');
	const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
	const env = makeEnv();
	const f2 = createFrame(breakoutDef, { window: env.win, document: env.doc, storage: bad });
	f2.storage.setBest(50);
	assert.equal(f2.storage.getBest(), 50); assert.equal(f2.storage.fallback, true);
	f2.destroy();
	store.setItem('hideout:v1:breakout:best', 'garbage');
	assert.equal(f1.storage.getBest(), 120);
});
check('S7.7 crash: throwing update -> destroyed, onCrash called, registry empty', () => {
	const env = makeEnv({ storage: memStore() });
	let crashed = null;
	const def = { ...breakoutDef, createGame(fr) { const g = breakoutDef.createGame(fr); g.update = () => { throw new Error('boom'); }; return g; } };
	const frame = createFrame(def, { window: env.win, document: env.doc, onCrash: (e) => { crashed = e; } });
	frame.mount(env.panel); frame.start(); env.raf(1000);
	assert.ok(crashed); assert.equal(frame.state, 'destroyed'); assert.equal(frame.registry.size(), 0);
});

console.error = origError;
check('S7.8 zero console errors during the scripted session', () => { assert.deepEqual(consoleErrors, []); });

console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
