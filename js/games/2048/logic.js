// 2048 rules. Pure: no DOM, no timers. State in, state out.
// The RNG is a seed carried in the state (mulberry32), so runs are reproducible.

export const SIZE = 4;
export const WIN_TILE = 2048;
export const FOUR_CHANCE = 0.1;

export function nextRandom(seed) {
	let t = (seed + 0x6d2b79f5) >>> 0;
	let r = Math.imul(t ^ (t >>> 15), 1 | t);
	r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
	return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}

const emptyGrid = () => Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));

// Slide one line toward index 0. Each tile merges at most once per move.
export function slideLine(line) {
	const tiles = line.filter((v) => v);
	const out = [];
	let gained = 0;
	for (let i = 0; i < tiles.length; i++) {
		if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
			const v = tiles[i] * 2;
			out.push(v);
			gained += v;
			i++; // the merged partner is consumed; the result cannot merge again
		} else {
			out.push(tiles[i]);
		}
	}
	while (out.length < SIZE) out.push(0);
	return { line: out, gained };
}

function spawn(state) {
	const free = [];
	for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!state.grid[r][c]) free.push([r, c]);
	if (!free.length) return state;
	let [a, seed] = nextRandom(state.seed);
	let b;
	[b, seed] = nextRandom(seed);
	const [r, c] = free[Math.floor(a * free.length)];
	const grid = state.grid.map((row) => row.slice());
	grid[r][c] = b < FOUR_CHANCE ? 4 : 2;
	return { ...state, grid, seed };
}

export function hasMoves(grid) {
	for (let r = 0; r < SIZE; r++) {
		for (let c = 0; c < SIZE; c++) {
			if (!grid[r][c]) return true;
			if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return true;
			if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return true;
		}
	}
	return false;
}

export function createState(seed = 1) {
	let s = { grid: emptyGrid(), score: 0, seed: seed >>> 0, over: false, won: false, moves: 0 };
	s = spawn(s);
	return spawn(s);
}

// Returns a new state; the same object if the move changes nothing.
export function move(state, dir) {
	if (state.over) return state;
	const horizontal = dir === 'left' || dir === 'right';
	const reverse = dir === 'right' || dir === 'down';
	const grid = emptyGrid();
	let gained = 0;
	let changed = false;
	for (let i = 0; i < SIZE; i++) {
		const line = [];
		for (let j = 0; j < SIZE; j++) {
			const k = reverse ? SIZE - 1 - j : j;
			line.push(horizontal ? state.grid[i][k] : state.grid[k][i]);
		}
		const res = slideLine(line);
		gained += res.gained;
		for (let j = 0; j < SIZE; j++) {
			const k = reverse ? SIZE - 1 - j : j;
			const v = res.line[j];
			const [r, c] = horizontal ? [i, k] : [k, i];
			grid[r][c] = v;
			if (v !== state.grid[r][c]) changed = true;
		}
	}
	if (!changed) return state;
	let s = { ...state, grid, score: state.score + gained, moves: state.moves + 1 };
	if (!s.won && grid.some((row) => row.some((v) => v >= WIN_TILE))) s.won = true; // play may continue
	s = spawn(s);
	s.over = !hasMoves(s.grid);
	return s;
}
