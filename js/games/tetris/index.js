// Tetris frame definition: wires pure logic + renderer + on-screen buttons into the frame contract.
import { createState, move, rotate, softDrop, hardDrop, tick, gravityMs } from './logic.js';
import { draw } from './render.js';

const BTN_MIN_PX = 44;

const BUTTONS = [
	['left', '◀', 'Move left', 'hx-t-left'],
	['rotate', '↻', 'Rotate', 'hx-t-rotate'],
	['right', '▶', 'Move right', 'hx-t-right'],
	['soft', '▼', 'Soft drop', 'hx-t-soft'],
	['hard', '⤓', 'Hard drop', 'hx-t-hard'],
];

export const tetrisDef = {
	id: 'tetris',
	title: 'Tetris',
	ariaLabel: 'Tetris game board. Use left and right arrows to move, up arrow to rotate, down arrow for soft drop, space for hard drop. P pauses. On touch screens use the on-screen buttons.',
	keymap: {
		ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', ArrowDown: 'soft', ' ': 'hard',
	},
	createGame(frame) {
		let state = createState(frame.ctx.rng);
		let acc = 0;

		function act(action) {
			if (state.over) return;
			if (action === 'left') move(state, -1);
			else if (action === 'right') move(state, 1);
			else if (action === 'rotate') rotate(state);
			else if (action === 'soft') { softDrop(state); acc = 0; }
			else if (action === 'hard') { hardDrop(state); acc = 0; }
		}

		const c = frame.canvas;
		const parent = c && c.parentNode;
		const d = c && (c.ownerDocument || (typeof document !== 'undefined' ? document : null));
		if (parent && parent.appendChild && d && d.createElement) {
			const bar = d.createElement('div');
			bar.className = 'hx-tetris-controls';
			bar.setAttribute('role', 'group');
			bar.setAttribute('aria-label', 'Tetris touch controls');
			Object.assign(bar.style, {
				position: 'absolute', right: '0', bottom: '0', width: 'min(50%, 240px)',
				display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', padding: '6px',
				boxSizing: 'border-box', touchAction: 'none', zIndex: '1',
			});
			BUTTONS.forEach(([action, glyph, label, cls]) => {
				const b = d.createElement('button');
				b.type = 'button';
				b.className = 'hx-btn ' + cls;
				b.textContent = glyph;
				b.setAttribute('aria-label', label);
				Object.assign(b.style, { minWidth: BTN_MIN_PX + 'px', minHeight: BTN_MIN_PX + 'px', touchAction: 'none', fontSize: '1.25rem' });
				if (action === 'hard') b.style.gridColumn = 'span 2';
				bar.appendChild(b);
				const press = (e) => {
					if (frame.state !== 'running') return;
					if (e.preventDefault) e.preventDefault();
					act(action);
				};
				// pointerdown covers touch, pen and mouse; click handles keyboard activation (detail 0)
				frame.listen(b, 'pointerdown', press);
				frame.listen(b, 'click', (e) => { if (e.detail === 0) press(e); });
			});
			parent.appendChild(bar);
		}

		return {
			reset(ctx) {
				state = createState(ctx.rng);
				acc = 0;
			},
			onAction: act,
			update(dt) {
				acc += dt;
				while (acc >= gravityMs(state.level) && !state.over) {
					acc -= gravityMs(state.level);
					tick(state);
				}
			},
			render(g, w, h, opts) { draw(g, state, w, h, opts); },
			isOver() { return state.over; },
			getScore() { return state.score; },
			getStats() { return { score: state.score, lines: state.lines, level: state.level }; },
		};
	},
};
