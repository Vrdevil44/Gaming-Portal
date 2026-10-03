// Run: node test/quiz-ui.test.mjs   (Node 18+, no dependencies, minimal stub DOM)
import assert from 'node:assert/strict';
import { recommend } from '../js/quiz/engine.js';
import { QUESTIONS } from '../js/quiz/questions.js';
import { openQuiz, widenedNote, posterUrl, progressLabel } from '../js/quiz/ui.js';

let failed = 0;
function check(name, fn) {
	try { fn(); console.log('PASS', name); } catch (e) { failed++; console.log('FAIL', name, '\n  ', e.message); }
}

// ---- stub DOM ----
class Node {
	constructor(tag) { this.tag = tag; this.children = []; this.parent = null; this.attrs = {}; this.dataset = {}; this._l = {}; this.className = ''; this._text = ''; this.id = ''; }
	append(...k) { for (const c of k) { c.parent = this; this.children.push(c); } }
	get firstChild() { return this.children[0]; }
	set textContent(t) { this.children = []; this._text = t; }
	get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
	setAttribute(k, v) { this.attrs[k] = v; }
	addEventListener(t, f) { (this._l[t] ||= []).push(f); }
	fire(t, ev = {}) { (this._l[t] || []).forEach((f) => f(ev)); }
	click() { this.fire('click'); }
	focus() { doc.activeElement = this; }
	remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); }
	replaceWith(n) { n.parent = this.parent; this.parent.children = this.parent.children.map((c) => (c === this ? n : c)); }
	get classList() { return { remove() {} , add() {} }; }
	find(pred, out = []) { if (pred(this)) out.push(this); this.children.forEach((c) => c.find(pred, out)); return out; }
	byClass(c) { return this.find((n) => n.className.split(' ').includes(c)); }
}
const doc = {
	activeElement: null,
	body: new Node('body'), head: new Node('head'), documentElement: new Node('html'),
	createElement: (t) => new Node(t),
	getElementById(id) { return this.head.find((n) => n.id === id)[0] || null; },
};
globalThis.document = doc;

const NOW = Date.UTC(2026, 9, 3, 12);
const ctx = { now: () => NOW };
const title = (n) => n.byClass('hx-q-name')[0].textContent;
const runners = (n) => n.byClass('hx-q-ru')[0].children.map((li) => li.textContent);
function run(answers) {
	const q = openQuiz(ctx);
	for (let i = 0; i < 5; i++) {
		assert.match(q.overlay.byClass('hx-q-step')[0].textContent, new RegExp(`Question ${i + 1} of 5`));
		assert.equal(q.overlay.byClass('hx-q-dot').filter((d) => d.dataset.on === 'true').length, i + 1);
		const opts = q.overlay.byClass('hx-q-opt');
		assert.equal(opts.length, 4);
		opts[answers[i]].click();
	}
	return q;
}

check('pure helpers', () => {
	assert.equal(progressLabel(0), 'Question 1 of 5');
	assert.equal(widenedNote([]), '');
	assert.match(widenedNote(['intensity', 'time']), /intensity and time limit/);
	assert.ok(posterUrl({ poster: 'god-960.webp' }).endsWith('/god-960.webp'));
});

const A = [1, 2, 3, 0, 1];
check('scripted run renders winner + 2 runners-up + reason, aria-live', () => {
	const exp = recommend(A, { now: NOW });
	const q = run(A);
	assert.equal(title(q.overlay), exp.winner.title);
	assert.deepEqual(runners(q.overlay), exp.runnersUp.map((g) => g.title));
	assert.equal(runners(q.overlay).length, 2);
	assert.equal(q.overlay.byClass('hx-q-reason')[0].textContent, exp.reason);
	assert.equal(q.overlay.byClass('hx-q-result')[0].attrs['aria-live'], 'polite');
	assert.equal(q.overlay.byClass('hx-q-poster')[0].attrs && q.overlay.byClass('hx-q-poster')[0].alt, exp.winner.title);
	q.close();
	assert.equal(doc.body.children.length, 0);
});

check('re-roll excludes every shown pick, repeatedly', () => {
	const q = run(A);
	const seen = new Set([title(q.overlay), ...runners(q.overlay)]);
	for (let n = 0; n < 2; n++) {
		q.overlay.byClass('hx-primary')[0].click();
		const batch = [title(q.overlay), ...runners(q.overlay)];
		for (const t of batch) assert.ok(!seen.has(t), `repeat ${t}`);
		batch.forEach((t) => seen.add(t));
	}
	q.close();
});

check('widened note appears iff engine widens', () => {
	let widenA, plainA;
	for (let n = 0; n < 1024 && !(widenA && plainA); n++) {
		const a = [0, 1, 2, 3, 4].map((i) => (n >> (2 * i)) & 3);
		const r = recommend(a, { now: NOW });
		if (r.widened.length) widenA ||= { a, r }; else plainA ||= a;
	}
	assert.ok(widenA, 'no widening combo found in DB');
	const q = run(widenA.a);
	const note = q.overlay.byClass('hx-q-widen');
	assert.equal(note.length, 1);
	assert.equal(note[0].textContent, widenedNote(widenA.r.widened));
	q.close();
	const q2 = run(plainA);
	assert.equal(q2.overlay.byClass('hx-q-widen').length, 0);
	q2.close();
});

check('exhausting re-rolls ends cleanly (no empty crash)', () => {
	const q = run(A);
	for (let n = 0; n < 30 && q.overlay.byClass('hx-primary').length; n++) q.overlay.byClass('hx-primary')[0].click();
	assert.equal(q.overlay.byClass('hx-primary').length, 0);
	assert.equal(q.overlay.byClass('hx-q-act').length, 1); // Start over
	q.close();
});

check('Escape closes and CSS is injected once', () => {
	const q = openQuiz(ctx);
	q.overlay.fire('keydown', { key: 'Escape' });
	assert.equal(doc.body.children.length, 0);
	assert.equal(doc.head.find((n) => n.id === 'hx-quiz-css').length, 1);
	assert.equal(QUESTIONS.length, 5);
});

console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
