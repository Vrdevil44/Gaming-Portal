// Pong frame definition: wires pure logic + renderer into the frame contract.
import { createState, update, setInput, setPlayerY } from './logic.js';
import { draw } from './render.js';

export const pongDef = {
	id: 'pong',
	title: 'Pong',
	ariaLabel: 'Pong game court. Move your paddle with Up and Down arrow keys or W and S, or drag on touch screens. First to 7 wins. P pauses.',
	keymap: { ArrowUp: 'up', ArrowDown: 'down', w: 'up', W: 'up', s: 'down', S: 'down' },
	createGame(frame) {
		let state = createState(frame.ctx.rng);
		const held = new Set();
		const syncInput = () => {
			const last = [...held].pop();
			setInput(state, last === 'up' ? -1 : last === 'down' ? 1 : 0);
		};
		const dirOf = (key) => pongDef.keymap[key];
		const doc = frame.canvas.ownerDocument || document;
		frame.listen(doc, 'keyup', (e) => { held.delete(dirOf(e.key)); syncInput(); });

		const c = frame.canvas;
		let dragging = false;
		const moveTo = (t) => {
			const r = c.getBoundingClientRect();
			if (r.height > 0) setPlayerY(state, (t.clientY - r.top) / r.height);
		};
		const onStart = (e) => {
			if (frame.state !== 'running') return;
			dragging = true; e.preventDefault(); moveTo(e.touches[0]);
		};
		const onMove = (e) => {
			if (!dragging || frame.state !== 'running') return;
			e.preventDefault(); moveTo(e.touches[0]);
		};
		const onEnd = () => { dragging = false; };
		frame.listen(c, 'touchstart', onStart, { passive: false });
		frame.listen(c, 'touchmove', onMove, { passive: false });
		frame.listen(c, 'touchend', onEnd, { passive: true });
		frame.listen(c, 'touchcancel', onEnd, { passive: true });

		return {
			reset(ctx) { state = createState(ctx.rng); held.clear(); },
			onAction(action) { held.delete(action); held.add(action); syncInput(); },
			update(dt) { update(state, dt); },
			render(g, w, h, opts) { draw(g, state, w, h, opts); },
			isOver() { return state.over; },
			getScore() { return state.playerScore; },
		};
	},
};
