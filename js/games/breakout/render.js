// Breakout canvas renderer. Reads state, draws; never mutates it.
import { PADDLE_W, PADDLE_H, PADDLE_Y, BALL_R } from './logic.js';

const BG = '#29323c';
const FG = '#e8e8f0';
const PADDLE = '#e58bff';
const ROWS = ['#bd0bf3', '#e58bff', '#8bd3ff', '#7be8b0', '#ffe27a', '#ffb06b', '#ff7a8a'];

export function draw(g, state, w, h, opts = {}) {
	g.fillStyle = BG;
	g.fillRect(0, 0, w, h);
	if (!state) return;
	for (const b of state.bricks) {
		if (!b.alive) continue;
		g.fillStyle = ROWS[b.row % ROWS.length];
		g.fillRect(b.x * w + 1, b.y * h + 1, b.w * w - 2, b.h * h - 2);
	}
	g.fillStyle = FG;
	g.font = `${Math.round(h / 24)}px sans-serif`;
	g.textAlign = 'left';
	g.fillText(`Score ${state.score}`, w * 0.04, h * 0.06);
	g.textAlign = 'center';
	g.fillText(`Level ${state.level}`, w * 0.5, h * 0.06);
	g.textAlign = 'right';
	g.fillText(`Lives ${state.lives}`, w * 0.96, h * 0.06);
	g.fillStyle = PADDLE;
	g.fillRect((state.paddleX - PADDLE_W / 2) * w, (PADDLE_Y - PADDLE_H / 2) * h, PADDLE_W * w, PADDLE_H * h);
	const b = state.ball;
	if (!opts.reducedMotion && state.serveMs <= 0) { // motion trail is skipped under prefers-reduced-motion
		g.fillStyle = 'rgba(255,255,255,0.18)';
		g.beginPath();
		g.arc((b.x - b.vx * 0.02) * w, (b.y - b.vy * 0.02) * h, BALL_R * w * 0.9, 0, Math.PI * 2);
		g.fill();
	}
	g.fillStyle = FG;
	g.beginPath();
	g.arc(b.x * w, b.y * h, BALL_R * w, 0, Math.PI * 2);
	g.fill();
}
