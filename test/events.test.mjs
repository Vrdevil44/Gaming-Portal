// Run: node test/events.test.mjs   (Node 18+, no dependencies)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EVENTS, eventStatus, listEvents, lastStart, nextStartAfter, formatCountdown, ENDED_WINDOW_MS } from '../js/events/events.js';
import { faceStates, handleDemoSubmit, nextFocusIndex } from '../js/events/modal.js';

let failed = 0;
function check(name, fn) {
	try { fn(); console.log('PASS', name); } catch (e) { failed++; console.log('FAIL', name, '\n  ', e.message); }
}
const ev = { id: 't', title: 'T', durationMin: 120, poster: 'vct' };
const at = (y, mo, d, h = 19, mi = 0, s = 0) => new Date(y, mo, d, h, mi, s).getTime();
const clock = (t) => ({ now: () => t });
const START = at(2026, 9, 2); // Fri 2026-10-02 19:00 local
assert.equal(new Date(START).getDay(), 5);
const END = START + 120 * 60000;

check('1min before start -> Upcoming, countdown 60s', () => {
	const s = eventStatus(ev, clock(START - 60000));
	assert.equal(s.state, 'Upcoming'); assert.equal(s.remainingMs, 60000); assert.equal(s.startMs, START);
	assert.equal(formatCountdown(s.remainingMs), '00:01:00');
});
check('at start -> Live', () => assert.equal(eventStatus(ev, clock(START)).state, 'Live'));
check('during -> Live, ends-in correct', () => {
	const s = eventStatus(ev, clock(START + 30 * 60000));
	assert.equal(s.state, 'Live'); assert.equal(s.remainingMs, 90 * 60000);
});
check('1min after end -> Ended', () => assert.equal(eventStatus(ev, clock(END + 60000)).state, 'Ended'));
check('12h after end -> rolled to next Friday Upcoming', () => {
	assert.equal(eventStatus(ev, clock(END + ENDED_WINDOW_MS - 1)).state, 'Ended');
	const s = eventStatus(ev, clock(END + ENDED_WINDOW_MS));
	assert.equal(s.state, 'Upcoming'); assert.equal(s.startMs, at(2026, 9, 9));
});
check('DST change (fall back / spring forward) keeps 19:00 local', () => {
	for (const [y, mo, d] of [[2026, 10, 6], [2026, 2, 13], [2026, 2, 6]]) { // week spanning US/EU changes
		const t = at(y, mo, d, 12);
		const s = eventStatus(ev, clock(t));
		assert.equal(new Date(s.startMs).getHours(), 19);
		assert.equal(new Date(s.startMs).getDay(), 5);
		const n = nextStartAfter(lastStart(t));
		assert.equal(new Date(n).getHours(), 19);
		assert.equal(new Date(n).getDate() === new Date(lastStart(t)).getDate(), false);
	}
});
check('countdown never decrements: derived from now, not a counter', () => {
	let t = START - 10000, now = () => t; const ctx = { now };
	let prev = eventStatus(ev, ctx).remainingMs;
	t += 3000; assert.equal(eventStatus(ev, ctx).remainingMs, prev - 3000); // stateless: same t -> same value
	assert.equal(eventStatus(ev, ctx).remainingMs, eventStatus(ev, ctx).remainingMs);
	t += 60 * 60000; // tab was hidden for an hour: jumps correctly
	assert.equal(eventStatus(ev, ctx).remainingMs, 0 + (eventStatus(ev, ctx).targetMs - t));
	t -= 60 * 60000; // clock moves back: value goes back up, no stale decrement
	assert.ok(eventStatus(ev, ctx).remainingMs > 0);
});
check('4-6 dummy events, posters exist, durations set', () => {
	assert.ok(EVENTS.length >= 4 && EVENTS.length <= 6);
	for (const e of EVENTS) {
		assert.ok(e.durationMin > 0);
		for (const w of [480, 960]) readFileSync(new URL(`../${e.poster}-${w}.webp`, import.meta.url));
	}
	assert.equal(listEvents(clock(START)).length, EVENTS.length);
});
check('default ctx reads Date.now', () => {
	const orig = Date.now; Date.now = () => START; try { assert.equal(eventStatus(ev).state, 'Live'); } finally { Date.now = orig; }
});

// ---- form / modal ----
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const modalHtml = html.slice(html.indexOf('id="myModal"'), html.indexOf('End Home'));
const forms = modalHtml.match(/<form[\s\S]*?<\/form>/g) || [];
check('two forms, no action/method/name attributes on forms or inputs', () => {
	assert.equal(forms.length, 2);
	for (const f of forms) {
		assert.ok(!/\saction=/.test(f) && !/\smethod=/.test(f));
		assert.ok(!/\sname=/.test(f));
	}
	assert.ok(!/<input[^>]*\sname=/.test(modalHtml));
});
check('demo label + skip link present', () => {
	assert.ok(modalHtml.includes('Demo only — no real account'));
	assert.ok(modalHtml.includes('Skip — just let me in'));
});
check('submit: preventDefault, closes, zero requests, nothing stored', () => {
	const calls = [];
	const saved = { fetch: globalThis.fetch, xhr: globalThis.XMLHttpRequest, ls: globalThis.localStorage, ss: globalThis.sessionStorage, beacon: globalThis.navigator?.sendBeacon };
	globalThis.fetch = (...a) => { calls.push(['fetch', a]); };
	globalThis.XMLHttpRequest = function () { calls.push(['xhr']); };
	const store = { setItem: (...a) => calls.push(['store', a]) };
	globalThis.localStorage = store; globalThis.sessionStorage = store;
	let prevented = 0, closed = 0;
	try { handleDemoSubmit({ preventDefault: () => prevented++ }, () => closed++); }
	finally { Object.assign(globalThis, { fetch: saved.fetch, XMLHttpRequest: saved.xhr }); globalThis.localStorage = saved.ls; globalThis.sessionStorage = saved.ss; }
	assert.equal(prevented, 1); assert.equal(closed, 1); assert.deepEqual(calls, []);
});
check('hidden face is inert (inert, not just hidden)', () => {
	assert.deepEqual(faceStates('front'), { front: { inert: false }, back: { inert: true } });
	assert.deepEqual(faceStates('back'), { front: { inert: true }, back: { inert: false } });
});
check('focus trap wraps both directions', () => {
	assert.equal(nextFocusIndex(4, 3, false), 0); assert.equal(nextFocusIndex(4, 0, true), 3);
	assert.equal(nextFocusIndex(4, -1, false), 0); assert.equal(nextFocusIndex(0, -1, false), -1);
});
check('CSS: modal at --z-modal, 16px fields, no raw z-index, no external URLs', () => {
	const css = readFileSync(new URL('../js/events/events.css', import.meta.url), 'utf8');
	assert.ok(/\.hx-modal \{[^}]*z-index: var\(--z-modal\)/.test(css));
	assert.ok(/\.hx-input \{[^}]*font-size: 16px/.test(css));
	assert.ok(!/z-index:\s*\d/.test(css)); assert.ok(!/https?:/.test(css));
	assert.ok(/backface-visibility: hidden/.test(css) && /preserve-3d/.test(css));
});
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
