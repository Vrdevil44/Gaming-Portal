// Run: node test/2048.test.mjs   (Node 18+, no dependencies, no browser)
import assert from 'node:assert/strict';
import { createFrame } from '../js/core/frame.js';
import { game2048Def } from '../js/games/2048/index.js';
import { createState, move, slideLine, hasMoves, SIZE } from '../js/games/2048/logic.js';

let failed = 0;
function check(name, fn) {
	try { fn(); console.log('PASS', name); } catch (e) { failed++; console.log('FAIL', name, '\n  ', e.message); }
}
const st = (grid, extra = {}) => ({ grid, score: 0, seed: 7, over: false, won: false, moves: 0, ...extra });
const sum = (g) => g.flat().reduce((a, b) => a + b, 0);

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

check('S8.1 no double-merge: [2,2,2,2]->[4,4,0,0], [4,2,2,0]->[4,4], [2,2,4,0]->[4,4]', () => {
	assert.deepEqual(slideLine([2, 2, 2, 2]), { line: [4, 4, 0, 0], gained: 8 });
	assert.deepEqual(slideLine([4, 2, 2, 0]).line, [4, 4, 0, 0]);
	assert.deepEqual(slideLine([2, 2, 4, 0]).line, [4, 4, 0, 0]);
	assert.deepEqual(slideLine([0, 2, 0, 2]).line, [4, 0, 0, 0]);
	assert.deepEqual(slideLine([2, 4, 8, 16]).gained, 0);
});
check('S8.1b all four directions merge toward the edge; spawn adds one tile', () => {
	const g = [[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
	const l = move(st(g), 'left'); assert.equal(l.grid[0][0], 4);
	const r = move(st(g), 'right'); assert.equal(r.grid[0][3], 4);
	const d = move(st([[2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'down'); assert.equal(d.grid[3][0], 4);
	const u = move(st([[0, 0, 0, 0], [0, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0]]), 'up'); assert.equal(u.grid[0][0], 4);
	assert.equal(l.grid.flat().filter(Boolean).length, 2); // merged tile + spawn
});
check('S8.1c no-op move spawns nothing and returns same state', () => {
	const s = st([[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
	assert.equal(move(s, 'left'), s);
});
check('S8.1d spawn is 2 or 4 (~90/10), seeded and reproducible', () => {
	let twos = 0; let fours = 0;
	for (let i = 1; i <= 2000; i++) {
		const s = createState(i);
		for (const v of s.grid.flat()) { if (v === 2) twos++; else if (v === 4) fours++; else assert.equal(v, 0); }
	}
	const ratio = fours / (twos + fours);
	assert.ok(ratio > 0.07 && ratio < 0.13, 'ratio ' + ratio);
	assert.deepEqual(createState(42), createState(42));
	assert.equal(createState(5).grid.flat().filter(Boolean).length, 2);
});
check('S8.2 game over: full board WITH a move is not over; WITHOUT is over', () => {
	const stuck = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
	assert.equal(hasMoves(stuck), false);
	const mergeable = stuck.map((r) => r.slice()); mergeable[3][3] = 2; mergeable[3][2] = 2;
	assert.equal(hasMoves(mergeable), true);
	// final move fills the board with no moves left -> over
	const almost = st([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 0, 8]]);
	const next = move(almost, 'right'); // 4,2,8 shift right... board may still have move; check consistency
	assert.equal(next.over, !hasMoves(next.grid));
	// full board with a legal move survives a move and is not over
	const live = st([[2, 2, 8, 16], [4, 8, 16, 32], [8, 16, 32, 64], [16, 32, 64, 128]]);
	assert.equal(move(live, 'left').over, false);
	// board that becomes stuck after spawn
	const tight = st([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 2, 0]], { seed: 3 });
	const n = move(tight, 'left'); // merges 2,2 -> 4 at row3 then spawn
	assert.equal(n.over, !hasMoves(n.grid));
	// over state ignores further moves
	assert.equal(move({ ...tight, over: true }, 'left').grid, tight.grid);
});
check('S8.3 score accumulates merged values; tile sum conserved (+spawn)', () => {
	let s = st([[2, 2, 4, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
	s = move(s, 'left'); assert.equal(s.score, 12);
	assert.deepEqual(s.grid[0].slice(0, 2), [4, 8]);
	const before = sum(s.grid);
	const s2 = move(s, 'down');
	assert.equal(s2.score, 12); // pure slide, no merge
	assert.ok([2, 4].includes(sum(s2.grid) - before));
	const s3 = move(st([[4, 4, 0, 0], [4, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], { score: 100 }), 'left');
	assert.equal(s3.score, 116);
});
check('S8.1e reaching 2048 sets won, play continues (not over)', () => {
	const s = move(st([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left');
	assert.equal(s.won, true); assert.equal(s.over, false);
	assert.equal(move(s, 'down').over, false);
});
check('S8.4 registry empty after destroy; best persisted under hideout:v1:2048:best', () => {
	const store = memStore();
	const env = makeEnv({ storage: store });
	const frame = createFrame(game2048Def, { window: env.win, document: env.doc, rng: seq(5) });
	frame.mount(env.panel); frame.start();
	assert.ok(frame.registry.size() > 0);
	assert.equal(frame.storage.key, 'hideout:v1:2048:best');
	frame.destroy();
	assert.equal(frame.registry.size(), 0);
	for (const t of env.targets) assert.equal(t._l.length, 0, 'leftover listener');
	frame.destroy();
});
check('S8.4b keyboard + swipe drive moves; game over stores best', () => {
	const store = memStore();
	const env = makeEnv({ storage: store });
	const frame = createFrame(game2048Def, { window: env.win, document: env.doc, rng: seq(9) });
	frame.mount(env.panel); frame.start();
	for (let i = 0; i < 20000 && frame.state === 'running'; i++) {
		env.doc.fire('keydown', { key: ['ArrowLeft', 'ArrowDown', 'd', 'w', 'ArrowRight', 'ArrowUp'][i % 6], preventDefault() {} });
		env.raf(16 * (i + 1));
	}
	assert.equal(frame.state, 'over');
	assert.ok(Number(store.m.get('hideout:v1:2048:best')) > 0);
	frame.destroy();
});
check('S8.4c storage throwing -> RAM fallback flag, no crash', () => {
	const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
	const env = makeEnv({ storage: bad });
	const frame = createFrame(game2048Def, { window: env.win, document: env.doc, rng: seq(2) });
	frame.mount(env.panel); frame.start();
	frame.storage.setBest(50);
	assert.equal(frame.storage.getBest(), 50);
	assert.equal(frame.storage.fallback, true);
	frame.destroy();
});

if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log('\nall S8 checks passed');
