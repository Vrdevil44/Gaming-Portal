// Snake canvas renderer. Reads state, draws; never mutates it.
import { GRID } from './logic.js';

const BG = '#29323c';
const GRID_LINE = 'rgba(255,255,255,0.05)';
const SNAKE = 'rgb(189, 11, 243)';
const HEAD = '#e58bff';
const FOOD = 'crimson';

export function draw(g, state, w, h, opts = {}) {
	const cell = w / GRID;
	g.fillStyle = BG;
	g.fillRect(0, 0, w, h);
	g.strokeStyle = GRID_LINE;
	g.lineWidth = 1;
	g.beginPath();
	for (let i = 1; i < GRID; i++) {
		g.moveTo(i * cell, 0); g.lineTo(i * cell, h);
		g.moveTo(0, i * cell); g.lineTo(w, i * cell);
	}
	g.stroke();
	if (!state) return;
	if (state.food) {
		// food pulse is skipped under prefers-reduced-motion
		const pulse = opts.reducedMotion ? 0 : Math.sin(Date.now() / 200) * cell * 0.06;
		g.fillStyle = FOOD;
		g.beginPath();
		g.arc((state.food.x + 0.5) * cell, (state.food.y + 0.5) * cell, cell * 0.36 + pulse, 0, Math.PI * 2);
		g.fill();
	}
	state.snake.forEach((c, i) => {
		g.fillStyle = i === 0 ? HEAD : SNAKE;
		g.fillRect(c.x * cell + 1, c.y * cell + 1, cell - 2, cell - 2);
	});
}
