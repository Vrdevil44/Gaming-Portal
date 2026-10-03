// Snake rules. Pure: no DOM, no timers. State in, state out.
// The RNG is a seed carried in the state (mulberry32), so runs are reproducible.

export const GRID = 20;
export const POINTS_PER_FOOD = 10;
export const SPEEDUP_EVERY = 5;
export const INPUT_BUFFER = 2;
export const BASE_TICK_MS = 150;
export const MIN_TICK_MS = 60;
export const TICK_STEP_MS = 10;

export const DIRS = {
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 },
};
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function nextRandom(seed) {
	let t = (seed + 0x6d2b79f5) >>> 0;
	let r = Math.imul(t ^ (t >>> 15), 1 | t);
	r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
	return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}

export function tickMsFor(foods) {
	return Math.max(MIN_TICK_MS, BASE_TICK_MS - TICK_STEP_MS * Math.floor(foods / SPEEDUP_EVERY));
}

export function spawnFood(snake, seed, size = GRID) {
	const taken = new Set(snake.map((c) => c.y * size + c.x));
	const empty = [];
	for (let i = 0; i < size * size; i++) if (!taken.has(i)) empty.push(i);
	if (!empty.length) return { food: null, seed };
	const [r, s] = nextRandom(seed);
	const i = empty[Math.floor(r * empty.length)];
	return { food: { x: i % size, y: Math.floor(i / size) }, seed: s };
}

export function createState(seed, size = GRID) {
	const mid = Math.floor(size / 2);
	const snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }];
	const { food, seed: s } = spawnFood(snake, seed >>> 0, size);
	return {
		size, snake, dir: 'right', queue: [], food, seed: s,
		score: 0, foods: 0, tickMs: BASE_TICK_MS, over: false, won: false,
	};
}

// Queue a turn. Validated against the last queued (or current) direction so
// LEFT-then-RIGHT cannot fold the snake back onto itself within one tick.
export function queueDir(state, dir) {
	if (state.over || !DIRS[dir]) return state;
	if (state.queue.length >= INPUT_BUFFER) return state;
	const ref = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
	if (dir === ref || dir === OPPOSITE[ref]) return state;
	return { ...state, queue: [...state.queue, dir] };
}

export function step(state) {
	if (state.over) return state;
	let dir = state.dir;
	let queue = state.queue;
	if (queue.length) { dir = queue[0]; queue = queue.slice(1); }
	const d = DIRS[dir];
	const head = { x: state.snake[0].x + d.x, y: state.snake[0].y + d.y };
	const base = { ...state, dir, queue };
	if (head.x < 0 || head.y < 0 || head.x >= state.size || head.y >= state.size) {
		return { ...base, over: true };
	}
	const eats = !!state.food && head.x === state.food.x && head.y === state.food.y;
	// the tail cell is vacated this tick unless we grow
	const body = eats ? state.snake : state.snake.slice(0, -1);
	if (body.some((c) => c.x === head.x && c.y === head.y)) return { ...base, over: true };
	const snake = [head, ...(eats ? state.snake : state.snake.slice(0, -1))];
	if (!eats) return { ...base, snake };
	const foods = state.foods + 1;
	const sp = spawnFood(snake, state.seed, state.size);
	return {
		...base, snake, foods, score: state.score + POINTS_PER_FOOD,
		tickMs: tickMsFor(foods), food: sp.food, seed: sp.seed,
		over: sp.food === null, won: sp.food === null,
	};
}
