// Run: node test/quiz.test.mjs   (Node 18+, no dependencies)
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { QUESTIONS } from '../js/quiz/questions.js';
import { GAMES } from '../js/quiz/db.js';
import { recommend, reroll } from '../js/quiz/engine.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ctx = { now: Date.UTC(2026, 9, 3, 12) };
let failed = 0;
function check(name, fn) {
	try { fn(); console.log('PASS', name); } catch (e) { failed++; console.log('FAIL', name, '\n  ', e.message); }
}

const combos = [];
for (let n = 0; n < 1024; n++) combos.push([0, 1, 2, 3, 4].map(i => (n >> (2 * i)) & 3));
const results = combos.map(a => recommend(a, ctx));

check('shape: 5 questions x 4 options, ordinal ones have a no-preference option', () => {
	assert.equal(QUESTIONS.length, 5);
	for (const q of QUESTIONS) {
		assert.equal(q.options.length, 4, q.id);
		assert.ok(q.options.some(o => o.id === 'nopref'), q.id);
	}
});
check('DB has 12-16 rows, unique ids', () => {
	assert.ok(GAMES.length >= 12 && GAMES.length <= 16);
	assert.equal(new Set(GAMES.map(g => g.id)).size, GAMES.length);
});
check('every DB row: poster exists (.webp) and values in range', () => {
	for (const g of GAMES) {
		assert.ok(g.poster.endsWith('.webp') && existsSync(ROOT + g.poster), `${g.id} poster ${g.poster}`);
		for (const k of ['reflexes', 'brain', 'timeCommitment']) assert.ok(Number.isInteger(g.axes[k]) && g.axes[k] >= 1 && g.axes[k] <= 5, `${g.id}.${k}`);
		assert.ok(g.intensity >= 1 && g.intensity <= 5, g.id);
		assert.ok(g.players[0] >= 1 && g.players[1] >= g.players[0], g.id);
		assert.ok(g.maxTimeMin > 0 && g.title && g.desc && g.tags.length, g.id);
	}
});
check('no combo returns empty (1,024 combos)', () => {
	assert.equal(results.length, 1024);
	results.forEach((r, i) => assert.ok(r.winner && r.reason, `combo ${combos[i]}`));
});
check('every combo has two distinct runners-up unless pool is tiny', () => {
	const short = results.filter(r => r.runnersUp.length < 2).length;
	console.log('   combos with <2 runners-up:', short);
	assert.ok(short / 1024 <= 0.05);
});
check('every game is top-3 at least once', () => {
	const seen = new Set();
	for (const r of results) [r.winner, ...r.runnersUp].forEach(g => seen.add(g.id));
	const missing = GAMES.filter(g => !seen.has(g.id)).map(g => g.id);
	assert.deepEqual(missing, []);
});
check('no game is #1 in >15% of combos', () => {
	const c = {};
	for (const r of results) c[r.winner.id] = (c[r.winner.id] || 0) + 1;
	const sorted = Object.entries(c).sort((a, b) => b[1] - a[1]);
	console.log('   #1 share:', sorted.map(([k, v]) => `${k} ${(v / 10.24).toFixed(1)}%`).join(', '));
	assert.ok(sorted[0][1] / 1024 <= 0.15, `${sorted[0][0]} at ${(sorted[0][1] / 10.24).toFixed(1)}%`);
});
check('widen path: impossible filters -> lowest-priority dropped and reported', () => {
	// solo(1 player) + <=15 min + redline: nothing fits intensity [4,5] AND players 1 AND <=15 min? force with custom db
	const mk = (id, intensity) => ({ ...GAMES[0], id, players: [1, 1], maxTimeMin: 10, intensity });
	const games = [mk('a', 3), mk('b', 2), mk('c', 3)];
	const r = recommend([0, 3, 0, 2, 3], { ...ctx, games });
	assert.deepEqual(r.widened, ['intensity']);
	assert.ok(r.winner);
	const r2 = recommend([0, 3, 2, 2, 3], { ...ctx, games }); // squad too
	assert.deepEqual(r2.widened, ['intensity', 'time', 'players']);
	assert.ok(r2.winner);
});
check('tie-break deterministic for fixed date, varies by date', () => {
	const a = [3, 3, 3, 3, 3]; // all no-preference: everything ties
	const r1 = recommend(a, ctx), r2 = recommend(a, ctx);
	assert.equal(r1.winner.id, r2.winner.id);
	assert.deepEqual(r1.ranking, r2.ranking);
	const others = new Set([1, 2, 3, 4, 5, 6].map(d => recommend(a, { now: Date.UTC(2026, 9, 3 + d) }).winner.id));
	assert.ok(others.size > 1, 'date seed should change the pick on some days');
});
check('re-roll excludes shown picks', () => {
	for (const a of combos.filter((_, i) => i % 37 === 0)) {
		const first = recommend(a, ctx);
		const shown = [first.winner, ...first.runnersUp];
		const second = reroll(a, ctx, shown);
		const ids = new Set(shown.map(g => g.id));
		assert.ok(second.winner && !ids.has(second.winner.id), `combo ${a}`);
		second.runnersUp.forEach(g => assert.ok(!ids.has(g.id)));
	}
});
check('result has reason line and winner not repeated in runners-up', () => {
	for (const r of results) {
		assert.equal(typeof r.reason, 'string');
		assert.ok(!r.reason.includes('\n'));
		assert.ok(!r.runnersUp.some(g => g.id === r.winner.id));
	}
});
check('engine is pure (no DOM globals referenced)', async () => {
	const { readFileSync } = await import('node:fs');
	for (const f of ['engine', 'questions', 'db']) {
		const src = readFileSync(new URL(`../js/quiz/${f}.js`, import.meta.url), 'utf8');
		assert.ok(!/\b(document|window|fetch|XMLHttpRequest|localStorage)\b/.test(src), f);
	}
});

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
