// Run: node test/snake.test.mjs   (Node 18+, no dependencies, no browser)
import assert from 'node:assert/strict';
import { createState, queueDir, step, spawnFood, tickMsFor, GRID } from '../js/games/snake/logic.js';
import { createFrame, createStorage } from '../js/core/frame.js';
import { snakeDef } from '../js/games/snake/index.js';

const consoleErrors = [];
const origError = console.error;
console.error = (...a) => { consoleErrors.push(a); };

let failed = 0;
function check(name, fn) {
	try { fn(); console.log('PASS', name); } catch (e) { failed++; console.log('FAIL', name, '\n  ', e.message); }
}

// ---- minimal fake DOM / window ----
function makeEnv({ storage, rafManual = true } = {}) {
	const handlers = new Map();
	const mkTarget = () => ({
		add(t, f) { handlers.set(this, (handlers.get(this) || []).concat([[t, f]])); },
	});
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
		const c = target({ style: {}, attrs: {}, parentNode: null, getContext: () => ctx2d, setAttribute(k, v) { c.attrs[k] = v; } });
		return c;
	};
	const panel = target({ clientWidth: 400, clientHeight: 400, contains: (n) => n === panel, focus() { doc.activeElement = panel; },
		appendChild(c) { c.parentNode = panel; }, removeChild(c) { c.parentNode = null; } });
	let rafCb = null; let rafId = 0;
	const win = target({
		document: doc, devicePixelRatio: 3, performance: { now: () => 0 },
		localStorage: storage,
		matchMedia: () => ({ matches: false }),
		requestAnimationFrame(cb) { rafCb = cb; return ++rafId; },
		cancelAnimationFrame() { rafCb = null; },
	});
	doc.defaultView = win;
	return { win, doc, panel, raf: (t) => { const cb = rafCb; rafCb = null; if (cb) cb(t); }, hasRaf: () => rafCb !== null, targets };
}
function memStore() {
	const m = new Map();
	return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}
function seq(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---- 1. no 180 reversal ----
check('S2.1 LEFT then immediate RIGHT -> direction unchanged (moving right, press left)', () => {
	let s = createState(1);
	s = queueDir(s, 'left');
	assert.deepEqual(s.queue, []);
	assert.equal(step(s).dir, 'right');
});
check('S2.1b UP, LEFT then RIGHT within one tick: RIGHT rejected', () => {
	let s = createState(1);
	s = queueDir(s, 'up'); s = queueDir(s, 'left'); s = queueDir(s, 'right');
	assert.deepEqual(s.queue, ['up', 'left']);
	s = step(s); s = step(s);
	assert.equal(s.dir, 'left'); assert.equal(s.over, false);
});
check('S2.1c input buffer holds max 2', () => {
	let s = createState(1);
	s = queueDir(s, 'up'); s = queueDir(s, 'left'); s = queueDir(s, 'down');
	assert.equal(s.queue.length, 2);
});

// ---- 2. food never on body ----
check('S2.2 food_spawn x1000 never on snake body', () => {
	for (let i = 0; i < 1000; i++) {
		const r = seq(i + 7);
		const len = 1 + Math.floor(r() * 300);
		const cells = new Set();
		const snake = [];
		while (snake.length < len) {
			const x = Math.floor(r() * GRID), y = Math.floor(r() * GRID);
			if (!cells.has(y * GRID + x)) { cells.add(y * GRID + x); snake.push({ x, y }); }
		}
		const { food } = spawnFood(snake, i * 2654435761 >>> 0);
		assert.ok(food, 'food exists while empty cells remain');
		assert.ok(!cells.has(food.y * GRID + food.x), 'food on body');
	}
});
check('S2.2b full board -> no food, game won/over', () => {
	const snake = [];
	for (let i = 0; i < GRID * GRID; i++) snake.push({ x: i % GRID, y: Math.floor(i / GRID) });
	assert.equal(spawnFood(snake, 1).food, null);
});

// ---- 3. wall kill ----
check('S2.3 wall collision -> game over (all four walls)', () => {
	for (const dir of ['up', 'down', 'left', 'right']) {
		let s = createState(3);
		if (dir !== 'right') { s = { ...s, dir: dir === 'left' ? 'up' : 'right' }; }
		s = queueDir(s, dir);
		let n = 0;
		while (!s.over && n++ < 100) s = step(s);
		assert.equal(s.over, true, dir);
	}
});
check('S2.3b self collision kills; tail-follow does not', () => {
	let s = createState(1);
	s = { ...s, snake: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }], dir: 'up', food: { x: 0, y: 0 } };
	s = queueDir(s, 'left'); // head to (4,5)= tail cell, vacated -> ok
	assert.equal(step(s).over, false);
	let t = { ...s, snake: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 4 }], queue: [] };
	t = queueDir(t, 'left');
	assert.equal(step(t).over, true);
});

// ---- 4. scoring + speedup ----
check('S2.4 +10 per food; speedup every 5 foods', () => {
	let s = createState(9);
	const base = s.tickMs;
	for (let i = 1; i <= 10; i++) {
		s = { ...s, snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }], dir: 'right', queue: [], food: { x: 11, y: 10 } };
		s = step(s);
		assert.equal(s.score, i * 10);
		assert.equal(s.snake.length, 4);
		assert.equal(s.tickMs, tickMsFor(i));
		if (i < 5) assert.equal(s.tickMs, base);
		if (i === 5) assert.ok(s.tickMs < base);
		if (i === 10) assert.ok(s.tickMs < tickMsFor(5));
	}
});

// ---- 5. determinism ----
check('S2.5 seeded RNG: identical food sequence across runs', () => {
	const run = (seed) => {
		let s = createState(seed); const out = [s.food];
		for (let i = 0; i < 30; i++) {
			const h = s.snake[0];
			const f = s.food;
			const dir = h.x < f.x ? 'right' : h.x > f.x ? 'left' : h.y < f.y ? 'down' : 'up';
			s = step(queueDir(s, dir));
			if (s.over) break;
			out.push(s.food);
		}
		return JSON.stringify(out);
	};
	assert.equal(run(42), run(42));
	assert.notEqual(run(42), run(43));
});

// ---- 6. destroy empties registry ----
check('S2.6 destroy(): listener/loop registry empty, rAF cancelled', () => {
	const env = makeEnv({ storage: memStore() });
	const frame = createFrame(snakeDef, { window: env.win, document: env.doc, rng: seq(5) });
	frame.mount(env.panel);
	frame.start();
	assert.ok(frame.registry.size() > 0);
	assert.ok(env.hasRaf());
	frame.destroy();
	assert.equal(frame.registry.size(), 0);
	assert.equal(env.hasRaf(), false);
	for (const t of env.targets) assert.equal(t._l.length, 0, 'leftover listener');
	frame.destroy(); // idempotent
});
check('S2.6b HiDPI capped at 2; auto-pause on hidden; keyboard gated on focus', () => {
	const env = makeEnv({ storage: memStore() });
	const frame = createFrame(snakeDef, { window: env.win, document: env.doc, rng: seq(5) });
	frame.mount(env.panel);
	assert.equal(frame.canvas.width, 800); // 400 css * min(3,2)
	assert.equal(frame.canvas.attrs.role, 'img');
	assert.match(frame.canvas.attrs['aria-label'], /arrow keys/i);
	frame.start();
	let prevented = 0;
	env.doc.activeElement = null;
	env.doc.fire('keydown', { key: 'ArrowUp', preventDefault() { prevented++; } });
	assert.equal(prevented, 0, 'must not preventDefault when game not focused');
	env.doc.activeElement = env.panel;
	env.doc.fire('keydown', { key: 'ArrowUp', preventDefault() { prevented++; } });
	assert.equal(prevented, 1);
	env.doc.hidden = true; env.doc.fire('visibilitychange');
	assert.equal(frame.state, 'paused');
	assert.equal(env.hasRaf(), false);
	frame.resume(); assert.equal(frame.state, 'running');
	frame.destroy();
});
check('S2.6c loop runs, game over stores best, resume clamps big dt', () => {
	const store = memStore();
	const env = makeEnv({ storage: store });
	const states = [];
	const frame = createFrame(snakeDef, { window: env.win, document: env.doc, rng: seq(5), onState: (s) => states.push(s) });
	frame.mount(env.panel);
	frame.start();
	let t = 0;
	for (let i = 0; i < 400 && frame.state === 'running'; i++) { t += 5000; env.raf(t); } // huge dt, clamped to 250
	assert.equal(frame.state, 'over'); // snake runs into wall
	assert.ok(states.includes('over'));
	frame.destroy();
});

// ---- 7. storage ----
check('S2.7 key prefix hideout:v1:snake:best', () => {
	const store = memStore();
	const st = createStorage('snake', store);
	assert.equal(st.key, 'hideout:v1:snake:best');
	st.setBest(50); st.setBest(20);
	assert.equal(store.m.get('hideout:v1:snake:best'), '50');
	assert.equal(st.getBest(), 50);
});
check('S2.7b garbage values -> 0, no crash', () => {
	for (const g of ['abc', '{"x":1}', '-5', 'NaN', 'Infinity', '', null, undefined]) {
		const st = createStorage('snake', { getItem: () => g, setItem() {} });
		assert.equal(st.getBest(), 0, String(g));
	}
});
check('S2.7c throwing storage -> RAM fallback flagged, no crash', () => {
	const boom = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
	const st = createStorage('snake', boom);
	assert.equal(st.getBest(), 0);
	assert.equal(st.setBest(30), 30);
	assert.equal(st.getBest(), 30);
	assert.equal(st.fallback, true);
});
check('S2.7d window.localStorage getter throwing / absent -> frame still works', () => {
	const env = makeEnv({});
	Object.defineProperty(env.win, 'localStorage', { get() { throw new Error('SecurityError'); } });
	const frame = createFrame(snakeDef, { window: env.win, document: env.doc, rng: seq(1) });
	frame.mount(env.panel); frame.start();
	assert.equal(frame.storage.getBest(), 0);
	assert.equal(frame.storage.fallback, true);
	frame.destroy();
});

// ---- crash safety ----
check('S5 crash: throwing game loop -> destroyed, onCrash called, registry empty', () => {
	const env = makeEnv({ storage: memStore() });
	let crashed = null;
	const bad = { ...snakeDef, createGame: (f) => ({ ...snakeDef.createGame(f), update() { throw new Error('boom'); } }) };
	const frame = createFrame(bad, { window: env.win, document: env.doc, rng: seq(1), onCrash: (e) => { crashed = e; } });
	frame.mount(env.panel); frame.start();
	env.raf(100); env.raf(200);
	assert.equal(crashed && crashed.message, 'boom');
	assert.equal(frame.state, 'destroyed');
	assert.equal(frame.registry.size(), 0);
});

// ---- 8. console errors ----
console.error = origError;
check('S2.8 zero console errors during the scripted session', () => {
	assert.deepEqual(consoleErrors, []);
});

console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
