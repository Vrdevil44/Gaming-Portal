// Frame contract: { id, title, mount(panel), start, pause, resume, resize, destroy }
// The frame owns the loop, keyboard input, storage and HiDPI; a game only supplies
// update/render/onAction. Everything it registers goes through the registry so
// destroy() can prove nothing is left pending.

export const STEP_MS = 1000 / 60;
export const MAX_FRAME_MS = 250;
export const MAX_DPR = 2;

export function createStorage(game, store) {
	const key = `hideout:v1:${game}:best`;
	let ram = 0;
	let fallback = false;
	const api = {
		key,
		get fallback() { return fallback; },
		getBest() {
			try {
				const n = Number(store.getItem(key));
				if (Number.isFinite(n) && n >= 0) return Math.floor(n);
				return ram;
			} catch (e) {
				fallback = true;
				return ram;
			}
		},
		setBest(score) {
			ram = Math.max(ram, score);
			try {
				store.setItem(key, String(ram));
			} catch (e) {
				fallback = true;
			}
			return ram;
		},
	};
	if (!store) fallback = true;
	return api;
}

function safeLocalStorage(win) {
	try { return win.localStorage; } catch (e) { return null; }
}

function makeStore(store) {
	return store || { getItem() { throw new Error('no storage'); }, setItem() { throw new Error('no storage'); } };
}

export function createFrame(def, opts = {}) {
	const win = opts.window || globalThis.window;
	const doc = opts.document || win.document;
	const ctx = {
		rng: opts.rng || Math.random,
		now: opts.now || (() => Date.now()),
	};
	const store = makeStore(opts.storage !== undefined ? opts.storage : safeLocalStorage(win));
	const storage = createStorage(def.id, store);
	const onState = opts.onState || (() => {});
	const onCrash = opts.onCrash || (() => {});
	const onScore = opts.onScore || (() => {});

	const listeners = [];
	let rafId = 0;
	let state = 'idle'; // idle | running | paused | over | destroyed
	let panel = null;
	let canvas = null;
	let g2d = null;
	let cssSize = 0;
	let last = 0;
	let acc = 0;
	let game = null;
	let shownScore = 0;

	function listen(target, type, fn, options) {
		target.addEventListener(type, fn, options);
		listeners.push({ target, type, fn, options });
	}
	function pending() {
		return listeners.length + (rafId ? 1 : 0);
	}
	function setState(s) {
		state = s;
		onState(s);
	}
	function reducedMotion() {
		try { return !!win.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
	}

	function crash(err) {
		if (state === 'destroyed') return;
		try { opts.logError ? opts.logError(err) : null; } catch (e) { /* ignore */ }
		frame.destroy();
		onCrash(err);
	}

	function render() {
		game.render(g2d, cssSize, cssSize, { reducedMotion: reducedMotion() });
	}

	function loop(t) {
		rafId = 0;
		if (state !== 'running') return;
		try {
			const dt = Math.min(Math.max(t - last, 0), MAX_FRAME_MS);
			last = t;
			acc += dt;
			while (acc >= STEP_MS && state === 'running') {
				game.update(STEP_MS);
				acc -= STEP_MS;
				const sc = game.getScore();
				if (sc !== shownScore) { shownScore = sc; onScore(sc); }
				if (game.isOver && game.isOver()) {
					render();
					storage.setBest(game.getScore());
					setState('over');
					return;
				}
			}
			render();
		} catch (err) {
			crash(err);
			return;
		}
		rafId = win.requestAnimationFrame(loop);
	}

	function schedule() {
		if (!rafId && state === 'running') {
			last = win.performance ? win.performance.now() : ctx.now();
			rafId = win.requestAnimationFrame(loop);
		}
	}
	function cancelLoop() {
		if (rafId) { win.cancelAnimationFrame(rafId); rafId = 0; }
	}

	function focused() {
		return !!panel && (doc.activeElement === panel || panel.contains(doc.activeElement));
	}

	function onKey(e) {
		if (state !== 'running' || !focused()) return;
		const action = def.keymap && def.keymap[e.key];
		if (!action) return;
		e.preventDefault();
		try { game.onAction(action); } catch (err) { crash(err); }
	}

	const frame = {
		id: def.id,
		title: def.title,
		ctx,
		storage,
		get state() { return state; },
		get canvas() { return canvas; },
		registry: { size: pending, listeners },
		listen,
		mount(p) {
			panel = p;
			canvas = doc.createElement('canvas');
			canvas.className = 'hx-canvas';
			canvas.setAttribute('role', 'img');
			canvas.setAttribute('aria-label', def.ariaLabel);
			canvas.style.touchAction = 'none';
			canvas.style.overscrollBehavior = 'contain';
			panel.appendChild(canvas);
			g2d = canvas.getContext('2d');
			game = def.createGame(frame);
			listen(doc, 'keydown', onKey);
			listen(doc, 'visibilitychange', () => {
				if (doc.hidden && state === 'running') frame.pause();
			});
			listen(win, 'resize', () => frame.resize());
			frame.resize();
			render();
		},
		start() {
			if (state === 'destroyed' || !game) return;
			acc = 0;
			shownScore = 0;
			game.reset(ctx);
			onScore(0);
			setState('running');
			if (panel.focus) panel.focus();
			schedule();
		},
		pause() {
			if (state !== 'running') return;
			cancelLoop();
			setState('paused');
		},
		resume() {
			if (state !== 'paused') return;
			acc = 0; // resume clamps accumulated time
			setState('running');
			schedule();
		},
		resize() {
			if (!canvas || state === 'destroyed') return;
			const w = panel.clientWidth || 400;
			const h = panel.clientHeight || w;
			cssSize = Math.max(120, Math.floor(Math.min(w, h)));
			const dpr = Math.min(win.devicePixelRatio || 1, MAX_DPR);
			canvas.width = Math.round(cssSize * dpr);
			canvas.height = Math.round(cssSize * dpr);
			canvas.style.width = cssSize + 'px';
			canvas.style.height = cssSize + 'px';
			if (g2d.setTransform) g2d.setTransform(dpr, 0, 0, dpr, 0, 0);
			if (state !== 'destroyed') render();
		},
		destroy() {
			if (state === 'destroyed') return;
			cancelLoop();
			while (listeners.length) {
				const l = listeners.pop();
				l.target.removeEventListener(l.type, l.fn, l.options);
			}
			if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
			canvas = null;
			g2d = null;
			game = null;
			state = 'destroyed';
		},
	};
	return frame;
}
