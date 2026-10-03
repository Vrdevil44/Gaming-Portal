// Quiz UI: "What should I play tonight?" Renders into an overlay at --z-modal.
// The engine stays pure; all DOM lives here. Pure helpers are exported for tests.
import { QUESTIONS } from './questions.js';
import { recommend, reroll } from './engine.js';

const WIDEN_LABEL = { players: 'player count', time: 'time limit', intensity: 'intensity' };

export function widenedNote(widened) {
	if (!widened || !widened.length) return '';
	const names = widened.map((k) => WIDEN_LABEL[k] || k);
	return `Not enough games matched everything, so we relaxed your ${names.join(' and ')} preference.`;
}

export function posterUrl(game) {
	return new URL('../../' + game.poster, import.meta.url).href;
}

export function progressLabel(i, total = QUESTIONS.length) {
	return `Question ${i + 1} of ${total}`;
}

const CSS = `
.hx-quiz-btn { cursor: pointer; min-height: 44px; min-width: 44px; margin-left: 8px; }
.hx-quiz-btn:focus-visible, .hx-q-opt:focus-visible, .hx-q-act:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
.hx-quiz { max-height: 92vh; overflow-y: auto; }
.hx-q-dots { display: flex; gap: 8px; justify-content: center; margin: 4px 0 10px; padding: 0; list-style: none; }
.hx-q-dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid rgb(189, 11, 243); }
.hx-q-dot[data-on="true"] { background: rgb(189, 11, 243); }
.hx-q-step { text-align: center; color: #ddd; font-size: 1.4rem; }
.hx-q-prompt { font-size: 2rem; margin: 8px 0 12px; text-align: center; }
.hx-q-opts { display: grid; gap: 8px; }
.hx-q-opt, .hx-q-act {
	min-height: 44px; min-width: 44px; padding: 10px 14px; cursor: pointer; color: #fff; background: transparent;
	border: 2px solid rgb(189, 11, 243); font: inherit; font-size: 1.6rem; text-align: left;
	transition: background-color 0.3s ease;
}
.hx-q-act { text-align: center; text-transform: uppercase; letter-spacing: 0.05rem; }
.hx-q-opt:hover, .hx-q-act:hover, .hx-q-act.hx-primary { background: rgb(189, 11, 243); }
.hx-q-result { display: grid; gap: 10px; }
.hx-q-win { display: grid; gap: 6px; text-align: center; }
.hx-q-poster { width: 100%; max-height: 220px; object-fit: cover; border-radius: 4px; background: #1b222a; }
.hx-q-ph { display: flex; align-items: center; justify-content: center; min-height: 120px; background: #1b222a; border-radius: 4px; color: #ddd; }
.hx-q-name { font-size: 2.2rem; text-transform: uppercase; letter-spacing: 0.1rem; }
.hx-q-reason, .hx-q-widen { font-size: 1.5rem; color: #ddd; }
.hx-q-widen { color: #ffb3c0; }
.hx-q-ru { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0; padding: 0; list-style: none; }
.hx-q-ru li { font-size: 1.4rem; text-align: center; }
.hx-q-ru img { width: 100%; height: 70px; object-fit: cover; border-radius: 4px; }
.hx-q-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
@media (prefers-reduced-motion: reduce) { .hx-q-opt, .hx-q-act { transition: none; } }
`;

function el(tag, cls, text) {
	const n = document.createElement(tag);
	if (cls) n.className = cls;
	if (text) n.textContent = text;
	return n;
}
function button(label, cls, onClick) {
	const b = el('button', cls, label);
	b.type = 'button';
	b.addEventListener('click', onClick);
	return b;
}
function poster(game, cls) {
	const img = el('img', cls);
	img.alt = game.title;
	img.loading = 'lazy';
	img.addEventListener('error', () => { // neutral placeholder, never a broken-image icon
		const ph = el('div', 'hx-q-ph', game.title);
		if (img.replaceWith) img.replaceWith(ph);
	});
	img.src = posterUrl(game);
	return img;
}

let active = null;

// ctx: { now?: () => ms | ms }. Defaults to the real clock.
export function openQuiz(ctx = {}) {
	if (active) active.close();
	const opener = document.activeElement;
	const nowOf = () => (typeof ctx.now === 'function' ? ctx.now() : ctx.now ?? Date.now());
	if (!document.getElementById('hx-quiz-css')) {
		const s = el('style');
		s.id = 'hx-quiz-css';
		s.textContent = CSS;
		document.head.append(s);
	}

	const overlay = el('div', 'hx-overlay');
	overlay.setAttribute('role', 'dialog');
	overlay.setAttribute('aria-modal', 'true');
	overlay.setAttribute('aria-label', 'What should I play tonight?');
	const box = el('div', 'hx-panel hx-quiz');
	const head = el('div', 'hx-head');
	head.append(el('h2', 'hx-title', 'What should I play tonight?'));
	const closeBtn = button('Close', 'hx-btn hx-close', () => api.close());
	closeBtn.setAttribute('aria-label', 'Close quiz');
	head.append(closeBtn);
	const body = el('div', 'hx-q-body');
	box.append(head, body);
	overlay.append(box);

	const answers = [];
	let shown = [];
	let baseCtx;

	function showQuestion(i) {
		body.textContent = '';
		const dots = el('ul', 'hx-q-dots');
		QUESTIONS.forEach((_, d) => {
			const li = el('li', 'hx-q-dot');
			li.dataset.on = String(d <= i);
			dots.append(li);
		});
		const step = el('p', 'hx-q-step', progressLabel(i));
		const q = QUESTIONS[i];
		const prompt = el('h3', 'hx-q-prompt', q.prompt);
		const opts = el('div', 'hx-q-opts');
		q.options.forEach((o, idx) => {
			opts.append(button(o.label, 'hx-q-opt', () => {
				answers[i] = idx;
				if (i + 1 < QUESTIONS.length) showQuestion(i + 1);
				else { baseCtx = { now: nowOf() }; shown = []; showResult(recommend(answers, baseCtx)); }
			}));
		});
		body.append(dots, step, prompt, opts);
		opts.firstChild.focus();
	}

	function showResult(res) {
		body.textContent = '';
		const wrap = el('div', 'hx-q-result');
		wrap.setAttribute('aria-live', 'polite');
		wrap.setAttribute('aria-atomic', 'true');
		let first;
		if (res.winner) {
			shown.push(res.winner, ...res.runnersUp);
			const win = el('div', 'hx-q-win');
			win.append(poster(res.winner, 'hx-q-poster'), el('h3', 'hx-q-name', res.winner.title), el('p', 'hx-q-reason', res.reason));
			wrap.append(win);
			const note = widenedNote(res.widened);
			if (note) wrap.append(el('p', 'hx-q-widen', note));
			if (res.runnersUp.length) {
				wrap.append(el('p', 'hx-q-step', 'Runners-up'));
				const ru = el('ul', 'hx-q-ru');
				for (const g of res.runnersUp) {
					const li = el('li');
					li.append(poster(g, 'hx-q-poster'), el('span', '', g.title));
					ru.append(li);
				}
				wrap.append(ru);
			}
		} else {
			wrap.append(el('p', 'hx-q-reason', 'No more fresh picks — you’ve seen everything we have. Start over?'));
		}
		const row = el('div', 'hx-q-row');
		if (res.winner) {
			const re = button('Re-roll', 'hx-q-act hx-primary', () => showResult(reroll(answers, baseCtx, shown)));
			row.append(re);
			first = re;
		}
		const again = button('Start over', 'hx-q-act', () => { answers.length = 0; showQuestion(0); });
		row.append(again);
		wrap.append(row);
		body.append(wrap);
		(first || again).focus();
	}

	overlay.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') { api.close(); return; }
		if (e.key !== 'Tab') return;
		const f = [...overlay.querySelectorAll('button')];
		if (!f.length) return;
		const a = f[0], z = f[f.length - 1];
		if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
		else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
	});

	const api = {
		overlay,
		close() {
			overlay.remove();
			document.documentElement.classList.remove('hx-lock');
			if (active === api) active = null;
			if (opener && opener.focus) opener.focus();
		},
	};
	document.body.append(overlay);
	document.documentElement.classList.add('hx-lock');
	showQuestion(0);
	active = api;
	return api;
}
