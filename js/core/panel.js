// Overlay game panel at --z-modal. One game at a time; the frame is destroyed on close.
import { createFrame } from './frame.js';

const STATES = ['idle', 'playing', 'paused', 'over', 'crashed'];

function el(tag, cls, text) {
	const n = document.createElement(tag);
	if (cls) n.className = cls;
	if (text) n.textContent = text;
	return n;
}
function btn(label, onClick, cls = '') {
	const b = el('button', 'hx-btn ' + cls, label);
	b.type = 'button';
	b.addEventListener('click', onClick);
	return b;
}

let active = null;

export function openGamePanel(def, opts = {}) {
	if (active) active.close();
	const opener = document.activeElement;

	const overlay = el('div', 'hx-overlay');
	overlay.setAttribute('role', 'dialog');
	overlay.setAttribute('aria-modal', 'true');
	overlay.setAttribute('aria-label', def.title);
	const box = el('div', 'hx-panel');
	const head = el('div', 'hx-head');
	const title = el('h2', 'hx-title', def.title);
	const score = el('span', 'hx-score', 'Score 0');
	score.setAttribute('aria-live', 'off');
	const pauseBtn = btn('Pause', () => frame.pause(), 'hx-pause');
	const closeBtn = btn('Close', () => api.close(), 'hx-close');
	closeBtn.setAttribute('aria-label', 'Close game');
	head.append(title, score, pauseBtn, closeBtn);

	const stage = el('div', 'hx-stage');
	stage.tabIndex = -1;
	const veil = el('div', 'hx-veil');
	veil.setAttribute('role', 'status');
	const msg = el('p', 'hx-msg');
	const best = el('p', 'hx-best');
	const note = el('p', 'hx-note');
	note.hidden = true;
	note.textContent = 'scores not saved on this device';
	const actions = el('div', 'hx-actions');
	veil.append(msg, best, note, actions);
	stage.append(veil);
	box.append(head, stage);
	overlay.append(box);

	function bestText() {
		const b = frame.storage.getBest();
		note.hidden = !frame.storage.fallback;
		return b ? `Personal best: ${b}` : 'no scores yet';
	}
	function setView(s) {
		overlay.dataset.state = s;
		pauseBtn.hidden = s !== 'playing';
		actions.textContent = '';
		const first = [];
		if (s === 'idle') {
			msg.textContent = def.title;
			best.textContent = bestText();
			first.push(btn('Play', () => frame.start(), 'hx-primary'));
			first.push(btn('Quit to portal', () => api.close()));
		} else if (s === 'paused') {
			msg.textContent = 'Paused';
			best.textContent = bestText();
			first.push(btn('Resume', () => frame.resume(), 'hx-primary'));
			first.push(btn('Restart', () => frame.start()));
			first.push(btn('Quit to portal', () => api.close()));
		} else if (s === 'over') {
			msg.textContent = `Game over: ${score.textContent.replace('Score ', '')}`;
			best.textContent = bestText();
			first.push(btn('Play again', () => frame.start(), 'hx-primary'));
			first.push(btn('Quit to portal', () => api.close()));
		} else if (s === 'crashed') {
			msg.textContent = 'game crashed, reload';
			best.textContent = '';
			first.push(btn('Close', () => api.close(), 'hx-primary'));
		}
		actions.append(...first);
		veil.hidden = s === 'playing';
		if (first[0]) first[0].focus();
		else stage.focus();
	}

	const frame = createFrame(def, {
		...opts,
		onState(s) { setView(s === 'running' ? 'playing' : s); },
		onScore(n) { score.textContent = `Score ${n}`; },
		onCrash(err) {
			if (opts.logError) opts.logError(err);
			else console.error(err);
			setView('crashed');
		},
	});

	function onKeydown(e) {
		if (e.key === 'Escape') { api.close(); return; }
		if ((e.key === 'p' || e.key === 'P') && frame.state === 'running') frame.pause();
		if (e.key === 'Tab') { // keep focus inside the dialog
			const f = [...overlay.querySelectorAll('button:not([hidden])')].filter((b) => !b.closest('[hidden]'));
			if (!f.length) return;
			const first = f[0];
			const lastEl = f[f.length - 1];
			if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
			else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
		}
	}
	overlay.addEventListener('keydown', onKeydown);

	const api = {
		frame,
		close() {
			frame.destroy();
			overlay.remove();
			document.documentElement.classList.remove('hx-lock');
			if (active === api) active = null;
			if (opener && opener.focus) opener.focus();
		},
	};
	document.body.append(overlay);
	document.documentElement.classList.add('hx-lock');
	frame.mount(stage);
	// the canvas sits under the veil; the veil carries the state UI
	setView('idle');
	active = api;
	return api;
}
