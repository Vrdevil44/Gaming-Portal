// 2048 canvas renderer. Reads state, draws; never mutates it.
import { SIZE } from './logic.js';

const BG = '#29323c';
const EMPTY = 'rgba(255,255,255,0.07)';
const PALETTE = {
	2: '#4b5563', 4: '#5b6478', 8: '#8a4fd0', 16: '#a43be0', 32: '#bd0bf3', 64: '#d44bd0',
	128: '#e58bff', 256: '#f0a050', 512: '#f08a30', 1024: '#f06a20', 2048: '#ffd23f',
};
const GAP_RATIO = 0.04;

export function draw(g, state, w, h) {
	g.fillStyle = BG;
	g.fillRect(0, 0, w, h);
	const gap = w * GAP_RATIO;
	const cell = (w - gap * (SIZE + 1)) / SIZE;
	for (let r = 0; r < SIZE; r++) {
		for (let c = 0; c < SIZE; c++) {
			const x = gap + c * (cell + gap);
			const y = gap + r * (cell + gap);
			const v = state ? state.grid[r][c] : 0;
			g.fillStyle = v ? (PALETTE[v] || '#ffd23f') : EMPTY;
			g.fillRect(x, y, cell, cell);
			if (!v) continue;
			g.fillStyle = v === 2048 ? '#1a1a1a' : '#fff';
			const digits = String(v).length;
			g.font = `bold ${Math.floor(cell * (digits > 3 ? 0.3 : digits > 2 ? 0.38 : 0.48))}px sans-serif`;
			g.textAlign = 'center';
			g.textBaseline = 'middle';
			g.fillText(String(v), x + cell / 2, y + cell / 2);
		}
	}
	if (state && state.won) {
		g.fillStyle = '#ffd23f';
		g.font = `bold ${Math.floor(w * 0.04)}px sans-serif`;
		g.textAlign = 'right';
		g.textBaseline = 'top';
		g.fillText('2048!', w - gap, 2);
	}
}
