// Join modal: demo-only 3D flip login. No network, no storage.
export function faceStates(side) {
	return { front: { inert: side !== 'front' }, back: { inert: side !== 'back' } };
}

// Demo bypass: never submits anywhere, just closes.
export function handleDemoSubmit(e, close) {
	e.preventDefault();
	close();
	return false;
}

// Pure focus-trap step: index to focus next given current index (-1 if outside).
export function nextFocusIndex(count, current, shift) {
	if (count === 0) return -1;
	if (current < 0) return shift ? count - 1 : 0;
	return (current + (shift ? -1 : 1) + count) % count;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function setupModal({ modal, openBtn }) {
	const box = modal.querySelector('.hx-modal-box');
	const flip = modal.querySelector('.hx-flip');
	const front = modal.querySelector('.hx-front');
	const back = modal.querySelector('.hx-back');
	const toggle = modal.querySelector('.hx-flip-toggle');
	let side = 'front';
	let opener = null;
	let inerted = [];

	function applySide() {
		const st = faceStates(side);
		for (const [face, key] of [[front, 'front'], [back, 'back']]) {
			face.inert = st[key].inert;
			face.setAttribute('aria-hidden', String(st[key].inert));
		}
		flip.dataset.side = side;
		toggle.textContent = side === 'front' ? 'No account? Sign up' : 'Have an account? Log in';
	}
	function focusables() {
		return [...box.querySelectorAll(FOCUSABLE)].filter((n) => !n.closest('[inert]'));
	}
	function close() {
		if (modal.hidden) return;
		modal.hidden = true;
		document.body.classList.remove('hx-scroll-lock');
		for (const n of inerted) n.inert = false;
		inerted = [];
		document.removeEventListener('keydown', onKey, true);
		if (opener && opener.focus) opener.focus();
	}
	function open() {
		opener = document.activeElement;
		side = 'front';
		applySide();
		modal.hidden = false;
		document.body.classList.add('hx-scroll-lock');
		inerted = [...document.body.children].filter((n) => n !== modal && !n.inert && n.tagName !== 'SCRIPT');
		for (const n of inerted) n.inert = true;
		document.addEventListener('keydown', onKey, true);
		const first = focusables()[0];
		if (first) first.focus();
	}
	function onKey(e) {
		if (e.key === 'Escape') { e.preventDefault(); close(); return; }
		if (e.key !== 'Tab') return;
		const list = focusables();
		const idx = list.indexOf(document.activeElement);
		const n = nextFocusIndex(list.length, idx, e.shiftKey);
		if (n >= 0) { e.preventDefault(); list[n].focus(); }
	}

	openBtn.addEventListener('click', open);
	toggle.addEventListener('click', () => { side = side === 'front' ? 'back' : 'front'; applySide(); });
	modal.querySelector('.hx-close').addEventListener('click', close);
	modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
	for (const f of modal.querySelectorAll('form')) f.addEventListener('submit', (e) => handleDemoSubmit(e, close));
	modal.querySelector('.hx-skip').addEventListener('click', (e) => { e.preventDefault(); close(); });
	applySide();
	return { open, close };
}
