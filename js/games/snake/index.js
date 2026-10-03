// Snake frame definition: wires pure logic + renderer into the frame contract.
import { createState, queueDir, step } from './logic.js';
import { draw } from './render.js';

const SWIPE_MIN_PX = 24;

function seedFrom(rng) {
	return Math.floor(rng() * 4294967296) >>> 0;
}

export const snakeDef = {
	id: 'snake',
	title: 'Snake',
	ariaLabel: 'Snake game board. Use arrow keys or W A S D to steer, or swipe on touch screens. Space or P pauses.',
	keymap: {
		ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
		w: 'up', W: 'up', a: 'left', A: 'left', s: 'down', S: 'down', d: 'right', D: 'right',
	},
	createGame(frame) {
		let state = createState(seedFrom(frame.ctx.rng));
		let acc = 0;

		let sx = 0;
		let sy = 0;
		let tracking = false;
		const c = frame.canvas;
		const onStart = (e) => {
			if (frame.state !== 'running') return;
			const t = e.touches[0];
			sx = t.clientX; sy = t.clientY; tracking = true;
			e.preventDefault();
		};
		const onMove = (e) => {
			if (!tracking || frame.state !== 'running') return;
			e.preventDefault();
			const t = e.touches[0];
			const dx = t.clientX - sx;
			const dy = t.clientY - sy;
			if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) return;
			const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
			state = queueDir(state, dir);
			sx = t.clientX; sy = t.clientY;
		};
		const onEnd = () => { tracking = false; };
		frame.listen(c, 'touchstart', onStart, { passive: false });
		frame.listen(c, 'touchmove', onMove, { passive: false });
		frame.listen(c, 'touchend', onEnd, { passive: true });
		frame.listen(c, 'touchcancel', onEnd, { passive: true });

		return {
			reset(ctx) {
				state = createState(seedFrom(ctx.rng));
				acc = 0;
			},
			onAction(dir) { state = queueDir(state, dir); },
			update(dt) {
				acc += dt;
				while (acc >= state.tickMs && !state.over) {
					state = step(state);
					acc -= state.tickMs;
				}
			},
			render(g, w, h, opts) { draw(g, state, w, h, opts); },
			isOver() { return state.over; },
			getScore() { return state.score; },
		};
	},
};
