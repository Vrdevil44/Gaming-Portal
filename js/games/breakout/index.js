// Breakout frame definition: wires pure logic + renderer into the frame contract.
import { createState, update, setInput, setPaddleX } from './logic.js';
import { draw } from './render.js';

export const breakoutDef = {
	id: 'breakout',
	title: 'Breakout',
	ariaLabel: 'Breakout game field. Move the paddle with Left and Right arrow keys or A and D, or drag on touch screens or with the mouse. Break all bricks; you have 3 lives. P pauses.',
	keymap: { ArrowLeft: 'left', ArrowRight: 'right', a: 'left', A: 'left', d: 'right', D: 'right' },
	createGame(frame) {
		let state = createState(frame.ctx.rng);
		const held = new Set();
		const syncInput = () => {
			const last = [...held].pop();
			setInput(state, last === 'left' ? -1 : last === 'right' ? 1 : 0);
		};
		const doc = frame.canvas.ownerDocument || document;
		frame.listen(doc, 'keyup', (e) => { held.delete(breakoutDef.keymap[e.key]); syncInput(); });

		const c = frame.canvas;
		let dragging = false;
		const moveTo = (p) => {
			const r = c.getBoundingClientRect();
			if (r.width > 0) setPaddleX(state, (p.clientX - r.left) / r.width);
		};
		const onStart = (e) => {
			if (frame.state !== 'running') return;
			dragging = true; e.preventDefault(); moveTo(e.touches ? e.touches[0] : e);
		};
		const onMove = (e) => {
			if (!dragging || frame.state !== 'running') return;
			e.preventDefault(); moveTo(e.touches ? e.touches[0] : e);
		};
		const onEnd = () => { dragging = false; };
		frame.listen(c, 'touchstart', onStart, { passive: false });
		frame.listen(c, 'touchmove', onMove, { passive: false });
		frame.listen(c, 'touchend', onEnd, { passive: true });
		frame.listen(c, 'touchcancel', onEnd, { passive: true });
		frame.listen(c, 'mousedown', onStart, { passive: false });
		frame.listen(c, 'mousemove', onMove, { passive: false });
		frame.listen(doc, 'mouseup', onEnd, { passive: true });

		return {
			reset(ctx) { state = createState(ctx.rng); held.clear(); dragging = false; },
			onAction(action) { held.delete(action); held.add(action); syncInput(); },
			update(dt) { update(state, dt); },
			render(g, w, h, opts) { draw(g, state, w, h, opts); },
			isOver() { return state.over; },
			getScore() { return state.score; },
		};
	},
};
