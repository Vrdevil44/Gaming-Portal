// Tetris canvas renderer. Reads state, draws; never mutates it.
import { COLS, ROWS, cellsOf, ghostY } from './logic.js';

const BG = '#29323c';
const GRID_LINE = 'rgba(255,255,255,0.05)';
const COLORS = {
	I: '#4dd2ff', O: '#ffd23f', T: '#bd0bf3', S: '#4ade80', Z: '#ef4444', J: '#5b6cff', L: '#ff9f43',
};

function block(g, x, y, cell, color) {
	g.fillStyle = color;
	g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
}

export function draw(g, state, w, h) {
	const cell = Math.floor(Math.min(w / 2, h / ROWS));
	const bw = cell * COLS;
	const bh = cell * ROWS;
	g.fillStyle = BG;
	g.fillRect(0, 0, w, h);
	g.fillStyle = 'rgba(0,0,0,0.25)';
	g.fillRect(0, 0, bw, bh);
	g.strokeStyle = GRID_LINE;
	g.lineWidth = 1;
	g.beginPath();
	for (let i = 1; i < COLS; i++) { g.moveTo(i * cell, 0); g.lineTo(i * cell, bh); }
	for (let i = 1; i < ROWS; i++) { g.moveTo(0, i * cell); g.lineTo(bw, i * cell); }
	g.stroke();
	if (!state) return;
	for (let y = 0; y < ROWS; y++) {
		for (let x = 0; x < COLS; x++) {
			const t = state.board[y][x];
			if (t) block(g, x * cell, y * cell, cell, COLORS[t]);
		}
	}
	if (!state.over) {
		const gy = ghostY(state);
		g.globalAlpha = 0.25;
		for (const [cx, cy] of cellsOf(state.piece.type, state.piece.rot)) {
			block(g, (state.piece.x + cx) * cell, (gy + cy) * cell, cell, COLORS[state.piece.type]);
		}
		g.globalAlpha = 1;
	}
	if (state.piece) {
		for (const [cx, cy] of cellsOf(state.piece.type, state.piece.rot)) {
			block(g, (state.piece.x + cx) * cell, (state.piece.y + cy) * cell, cell, COLORS[state.piece.type]);
		}
	}
	// side panel: next piece + stats
	const sx = bw + cell;
	g.fillStyle = '#fff';
	g.font = `${Math.max(10, Math.floor(cell * 0.7))}px sans-serif`;
	g.textBaseline = 'top';
	g.fillText('Next', sx, cell * 0.5);
	for (const [cx, cy] of cellsOf(state.next, 0)) block(g, sx + cx * cell, cell * 2 + cy * cell, cell, COLORS[state.next]);
	g.fillText(`Level ${state.level}`, sx, cell * 5);
	g.fillText(`Lines ${state.lines}`, sx, cell * 6.2);
}
