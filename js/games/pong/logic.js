// Pong rules. Pure: no DOM, no timers. All randomness comes from the injected rng (ctx.rng).
// Court is a unit square (0..1 both axes); speeds are units per second, dt is in ms.

export const WIN_SCORE = 7;
export const PADDLE_H = 0.2;
export const PADDLE_W = 0.025;
export const PADDLE_MARGIN = 0.03;
export const BALL_R = 0.016;
export const BALL_START_SPEED = 0.55;
export const BALL_MAX_SPEED = 1.5;
export const SPEEDUP_PER_HIT = 0.05;
export const MAX_BOUNCE_ANGLE = Math.PI / 3;
export const PLAYER_KEY_SPEED = 1.0;
export const AI_SPEED_FACTOR = 0.45; // AI paddle max speed = factor * current ball speed (always below it)
export const AI_LAG_MS = [120, 200];
export const AI_AIM_ERROR = 0.1; // max offset (court units) added to the AI's target
export const SERVE_DELAY_MS = 700;
const MAX_SUBSTEPS = 16;

export const PLAYER_FACE = PADDLE_MARGIN + PADDLE_W; // x of the player paddle's front face
export const AI_FACE = 1 - PADDLE_MARGIN - PADDLE_W;

export function aiMaxSpeed(ballSpeed) {
	return ballSpeed * AI_SPEED_FACTOR;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const clampPaddle = (y) => clamp(y, PADDLE_H / 2, 1 - PADDLE_H / 2);

function serve(state, towardAi) {
	const angle = (state.rng() - 0.5) * 2 * (Math.PI / 5);
	state.ball = {
		x: 0.5, y: 0.3 + state.rng() * 0.4,
		vx: (towardAi ? 1 : -1) * BALL_START_SPEED * Math.cos(angle),
		vy: BALL_START_SPEED * Math.sin(angle),
	};
	state.speed = BALL_START_SPEED;
	state.rally = 0;
	state.serveMs = SERVE_DELAY_MS;
	state.aiTarget = 0.5;
	state.aiTimerMs = 0;
}

export function createState(rng) {
	const state = {
		rng, playerY: 0.5, aiY: 0.5, playerScore: 0, aiScore: 0,
		input: 0, over: false, winner: null, ball: null, speed: BALL_START_SPEED,
		rally: 0, serveMs: 0, aiTarget: 0.5, aiTimerMs: 0, hits: 0,
	};
	serve(state, rng() < 0.5);
	return state;
}

export function setInput(state, dir) { state.input = dir; }
export function setPlayerY(state, y) { state.playerY = clampPaddle(y); }

function bounceOff(state, paddleY, dirX) {
	const b = state.ball;
	const off = clamp((b.y - paddleY) / (PADDLE_H / 2), -1, 1);
	const ang = off * MAX_BOUNCE_ANGLE;
	state.speed = Math.min(BALL_MAX_SPEED, state.speed + SPEEDUP_PER_HIT);
	b.vx = dirX * state.speed * Math.cos(ang);
	b.vy = state.speed * Math.sin(ang);
	state.rally++;
	state.hits++;
}

function point(state, playerScored) {
	if (playerScored) state.playerScore++; else state.aiScore++;
	if (state.playerScore >= WIN_SCORE || state.aiScore >= WIN_SCORE) {
		state.over = true;
		state.winner = playerScored ? 'player' : 'ai';
		return;
	}
	serve(state, playerScored); // serve toward the side that just lost the point
}

// Swept ball advance: finds the earliest wall / paddle-face / goal crossing inside the
// step, so no speed or dt can tunnel through a paddle.
export function moveBall(state, dtSec) {
	const b = state.ball;
	let rem = dtSec;
	for (let i = 0; i < MAX_SUBSTEPS && rem > 1e-9 && !state.over; i++) {
		let tHit = rem;
		let kind = null;
		if (b.vy < 0) { const t = (BALL_R - b.y) / b.vy; if (t <= tHit) { tHit = Math.max(0, t); kind = 'wall'; } }
		if (b.vy > 0) { const t = (1 - BALL_R - b.y) / b.vy; if (t <= tHit) { tHit = Math.max(0, t); kind = 'wall'; } }
		if (b.vx < 0) {
			const plane = PLAYER_FACE + BALL_R;
			if (b.x >= PADDLE_MARGIN) { // centre still in front of the paddle's back edge
				const t = (plane - b.x) / b.vx;
				const y = b.y + b.vy * t;
				if (t <= tHit && Math.abs(y - state.playerY) <= PADDLE_H / 2 + BALL_R) { tHit = Math.max(0, t); kind = 'player'; }
			}
			const t = (0 - b.x) / b.vx;
			if (kind === null && t <= tHit) { tHit = Math.max(0, t); kind = 'goalL'; }
		} else if (b.vx > 0) {
			const plane = AI_FACE - BALL_R;
			if (b.x <= 1 - PADDLE_MARGIN) {
				const t = (plane - b.x) / b.vx;
				const y = b.y + b.vy * t;
				if (t <= tHit && Math.abs(y - state.aiY) <= PADDLE_H / 2 + BALL_R) { tHit = Math.max(0, t); kind = 'ai'; }
			}
			const t = (1 - b.x) / b.vx;
			if (kind === null && t <= tHit) { tHit = Math.max(0, t); kind = 'goalR'; }
		}
		b.x += b.vx * tHit;
		b.y += b.vy * tHit;
		rem -= tHit;
		if (kind === 'wall') { b.y = clamp(b.y, BALL_R, 1 - BALL_R); b.vy = -b.vy; }
		else if (kind === 'player') { b.x = PLAYER_FACE + BALL_R; bounceOff(state, state.playerY, 1); }
		else if (kind === 'ai') { b.x = AI_FACE - BALL_R; bounceOff(state, state.aiY, -1); }
		else if (kind === 'goalL') { point(state, false); return; }
		else if (kind === 'goalR') { point(state, true); return; }
	}
}

// Where the ball will cross the AI's face, folding wall bounces.
export function predictY(ball) {
	if (ball.vx <= 0) return 0.5;
	const t = (AI_FACE - BALL_R - ball.x) / ball.vx;
	let y = ball.y + ball.vy * Math.max(0, t);
	const span = 1 - 2 * BALL_R;
	y = (((y - BALL_R) % (2 * span)) + 2 * span) % (2 * span);
	if (y > span) y = 2 * span - y;
	return y + BALL_R;
}

function updateAi(state, dtMs) {
	state.aiTimerMs -= dtMs;
	if (state.aiTimerMs <= 0) {
		// reaction lag: the AI only re-reads the ball every 120-200ms, then aims with error
		const [lo, hi] = AI_LAG_MS;
		state.aiTimerMs = lo + state.rng() * (hi - lo);
		const err = (state.rng() * 2 - 1) * AI_AIM_ERROR;
		state.aiTarget = clampPaddle((state.ball.vx > 0 ? predictY(state.ball) : 0.5) + err);
	}
	const maxMove = aiMaxSpeed(state.speed) * dtMs / 1000;
	state.aiY = clampPaddle(state.aiY + clamp(state.aiTarget - state.aiY, -maxMove, maxMove));
}

export function update(state, dtMs) {
	if (state.over) return state;
	if (state.input) setPlayerY(state, state.playerY + state.input * PLAYER_KEY_SPEED * dtMs / 1000);
	if (state.serveMs > 0) {
		state.serveMs -= dtMs;
		return state;
	}
	updateAi(state, dtMs);
	moveBall(state, dtMs / 1000);
	return state;
}
