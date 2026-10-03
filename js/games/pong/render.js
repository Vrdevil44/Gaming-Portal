// Pong canvas renderer. Reads state, draws; never mutates it.
import { PADDLE_H, PADDLE_W, PADDLE_MARGIN, BALL_R } from './logic.js';

const BG = '#29323c';
const FG = '#e8e8f0';
const PLAYER = '#e58bff';
const AI = 'rgb(189, 11, 243)';

export function draw(g, state, w, h, opts = {}) {
	g.fillStyle = BG;
	g.fillRect(0, 0, w, h);
	g.fillStyle = 'rgba(255,255,255,0.12)';
	for (let y = 0; y < h; y += h / 20) g.fillRect(w / 2 - 1, y, 2, h / 40);
	if (!state) return;
	g.fillStyle = FG;
	g.font = `${Math.round(h / 10)}px sans-serif`;
	g.textAlign = 'center';
	g.fillText(String(state.playerScore), w * 0.38, h * 0.12);
	g.fillText(String(state.aiScore), w * 0.62, h * 0.12);
	const pw = PADDLE_W * w;
	const ph = PADDLE_H * h;
	g.fillStyle = PLAYER;
	g.fillRect(PADDLE_MARGIN * w, state.playerY * h - ph / 2, pw, ph);
	g.fillStyle = AI;
	g.fillRect(w - PADDLE_MARGIN * w - pw, state.aiY * h - ph / 2, pw, ph);
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
