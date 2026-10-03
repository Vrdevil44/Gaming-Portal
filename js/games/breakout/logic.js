// Breakout rules. Pure: no DOM, no timers. All randomness comes from the injected rng (ctx.rng).
// Field is a unit square (0..1 both axes, y down); speeds are units per second, dt is in ms.

export const LIVES = 3;
export const COLS = 8;
export const BRICK_TOP = 0.12;
export const BRICK_H = 0.04;
export const BRICK_GAP = 0.006;
export const SIDE_MARGIN = 0.04;
export const BRICK_W = (1 - 2 * SIDE_MARGIN) / COLS;
export const MIN_ROWS = 3;
export const MAX_ROWS = 7;
export const PADDLE_W = 0.18;
export const PADDLE_H = 0.025;
export const PADDLE_Y = 0.93; // centre line of the paddle
export const BALL_R = 0.014;
export const BALL_START_SPEED = 0.6;
export const BALL_MAX_SPEED = 1.6;
export const LEVEL_SPEEDUP = 0.1; // +10% of start speed per level
export const MAX_BOUNCE_ANGLE = Math.PI / 3;
export const PADDLE_KEY_SPEED = 1.1;
export const SERVE_DELAY_MS = 700;
const MAX_SUBSTEPS = 64;
const EPS = 1e-9;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function levelSpeed(level) {
	return Math.min(BALL_MAX_SPEED, BALL_START_SPEED * (1 + LEVEL_SPEEDUP * (level - 1)));
}
export function rowsFor(level) {
	return Math.min(MAX_ROWS, MIN_ROWS + level - 1);
}

function buildBricks(level) {
	const bricks = [];
	for (let r = 0; r < rowsFor(level); r++) {
		for (let c = 0; c < COLS; c++) {
			bricks.push({
				x: SIDE_MARGIN + c * BRICK_W, y: BRICK_TOP + r * BRICK_H,
				w: BRICK_W, h: BRICK_H, row: r, alive: true,
			});
		}
	}
	return bricks;
}

function serve(state) {
	const angle = (state.rng() - 0.5) * 2 * (Math.PI / 5);
	state.speed = levelSpeed(state.level);
	state.ball = {
		x: clamp(state.paddleX, PADDLE_W / 2, 1 - PADDLE_W / 2), y: PADDLE_Y - PADDLE_H / 2 - BALL_R - 0.2,
		vx: state.speed * Math.sin(angle), vy: state.speed * Math.cos(angle),
	};
	state.serveMs = SERVE_DELAY_MS;
}

export function createState(rng) {
	const state = {
		rng, paddleX: 0.5, input: 0, score: 0, lives: LIVES, level: 1,
		over: false, ball: null, bricks: buildBricks(1), speed: BALL_START_SPEED,
		serveMs: 0, levelClears: 0, bricksLeft: 0,
	};
	state.bricksLeft = state.bricks.length;
	serve(state);
	return state;
}

export function setInput(state, dir) { state.input = dir; }
export function setPaddleX(state, x) { state.paddleX = clamp(x, PADDLE_W / 2, 1 - PADDLE_W / 2); }

function nextLevel(state) {
	state.level++;
	state.levelClears++;
	state.bricks = buildBricks(state.level);
	state.bricksLeft = state.bricks.length;
	serve(state);
}

function loseLife(state) {
	state.lives--;
	if (state.lives <= 0) { state.lives = 0; state.over = true; return; }
	serve(state);
}

// Swept ball (a point) vs a rect grown by BALL_R: earliest entry time in [0, tMax] and the hit axis.
function sweepRect(b, rx0, ry0, rx1, ry1, tMax) {
	const x0 = rx0 - BALL_R, x1 = rx1 + BALL_R, y0 = ry0 - BALL_R, y1 = ry1 + BALL_R;
	let tx0 = -Infinity, tx1 = Infinity, ty0 = -Infinity, ty1 = Infinity;
	if (Math.abs(b.vx) < EPS) { if (b.x < x0 || b.x > x1) return null; }
	else { const a = (x0 - b.x) / b.vx, c = (x1 - b.x) / b.vx; tx0 = Math.min(a, c); tx1 = Math.max(a, c); }
	if (Math.abs(b.vy) < EPS) { if (b.y < y0 || b.y > y1) return null; }
	else { const a = (y0 - b.y) / b.vy, c = (y1 - b.y) / b.vy; ty0 = Math.min(a, c); ty1 = Math.max(a, c); }
	const tIn = Math.max(tx0, ty0);
	const tOut = Math.min(tx1, ty1);
	if (tIn > tOut || tIn > tMax || tOut < 0) return null;
	if (tIn < 0) return null; // already inside (resting overlap): handled by position clamps, not a new hit
	return { t: tIn, axis: tx0 > ty0 ? 'x' : 'y' };
}

// Swept ball advance: finds the earliest wall / paddle / brick contact inside the step, so no
// speed or dt can tunnel through a brick or the paddle.
export function moveBall(state, dtSec) {
	const b = state.ball;
	let rem = dtSec;
	for (let i = 0; i < MAX_SUBSTEPS && rem > EPS && !state.over; i++) {
		let tHit = rem;
		let kind = null;
		let brick = null;
		let axis = 'y';
		if (b.vx < 0) { const t = (BALL_R - b.x) / b.vx; if (t <= tHit) { tHit = Math.max(0, t); kind = 'wall'; axis = 'x'; } }
		if (b.vx > 0) { const t = (1 - BALL_R - b.x) / b.vx; if (t <= tHit) { tHit = Math.max(0, t); kind = 'wall'; axis = 'x'; } }
		if (b.vy < 0) { const t = (BALL_R - b.y) / b.vy; if (t <= tHit) { tHit = Math.max(0, t); kind = 'wall'; axis = 'y'; } }
		if (b.vy > 0) {
			const px0 = state.paddleX - PADDLE_W / 2, px1 = state.paddleX + PADDLE_W / 2;
			const h = sweepRect(b, px0, PADDLE_Y - PADDLE_H / 2, px1, PADDLE_Y + PADDLE_H / 2, tHit);
			if (h && h.axis === 'y' && b.y <= PADDLE_Y) { tHit = h.t; kind = 'paddle'; }
			else {
				const t = (1 + BALL_R - b.y) / b.vy; // fully below the field: life lost
				if (t <= tHit) { tHit = Math.max(0, t); kind = 'miss'; }
			}
		}
		for (const br of state.bricks) {
			if (!br.alive) continue;
			const h = sweepRect(b, br.x, br.y, br.x + br.w, br.y + br.h, tHit);
			if (h && h.t <= tHit) { tHit = h.t; kind = 'brick'; brick = br; axis = h.axis; }
		}
		b.x += b.vx * tHit;
		b.y += b.vy * tHit;
		rem -= tHit;
		if (kind === 'wall') {
			b.x = clamp(b.x, BALL_R, 1 - BALL_R);
			b.y = Math.max(b.y, BALL_R);
			if (axis === 'x') b.vx = -b.vx; else b.vy = -b.vy;
		} else if (kind === 'paddle') {
			const off = clamp((b.x - state.paddleX) / (PADDLE_W / 2), -1, 1);
			const ang = off * MAX_BOUNCE_ANGLE;
			b.y = PADDLE_Y - PADDLE_H / 2 - BALL_R;
			b.vx = state.speed * Math.sin(ang);
			b.vy = -state.speed * Math.cos(ang);
		} else if (kind === 'brick') {
			brick.alive = false;
			state.bricksLeft--;
			state.score += 10 * state.level;
			if (axis === 'x') b.vx = -b.vx; else b.vy = -b.vy;
			if (state.bricksLeft <= 0) { nextLevel(state); return; }
		} else if (kind === 'miss') { loseLife(state); return; }
	}
}

export function update(state, dtMs) {
	if (state.over) return state;
	if (state.input) setPaddleX(state, state.paddleX + state.input * PADDLE_KEY_SPEED * dtMs / 1000);
	if (state.serveMs > 0) { state.serveMs -= dtMs; return state; }
	moveBall(state, dtMs / 1000);
	return state;
}
