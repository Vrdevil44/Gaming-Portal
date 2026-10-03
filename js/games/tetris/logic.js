// Tetris rules. Pure: no DOM, no timers. Randomness comes from an injected rng() in [0,1).
// Rotation is SRS-lite: clockwise only, horizontal kicks [0,-1,+1,-2,+2], no floor kicks, no hold.

export const COLS = 10;
export const ROWS = 20;
export const KICKS = [0, -1, 1, -2, 2];
export const LINE_POINTS = [0, 100, 300, 500, 800];
export const LINES_PER_LEVEL = 10;
export const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

// base (rotation 0) cells inside an n x n box; the top row of every box is occupied
const BASE = {
	I: { n: 4, c: [[0, 0], [1, 0], [2, 0], [3, 0]] },
	O: { n: 2, c: [[0, 0], [1, 0], [0, 1], [1, 1]] },
	T: { n: 3, c: [[1, 0], [0, 1], [1, 1], [2, 1]] },
	S: { n: 3, c: [[1, 0], [2, 0], [0, 1], [1, 1]] },
	Z: { n: 3, c: [[0, 0], [1, 0], [1, 1], [2, 1]] },
	J: { n: 3, c: [[0, 0], [0, 1], [1, 1], [2, 1]] },
	L: { n: 3, c: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};

export function cellsOf(type, rot) {
	const { n, c } = BASE[type];
	let out = c;
	for (let i = 0; i < ((rot % 4) + 4) % 4; i++) out = out.map(([x, y]) => [n - 1 - y, x]);
	return out;
}

export function gravityMs(level) {
	return Math.max(90, 800 - 70 * (level - 1));
}

export function levelFor(lines) {
	return 1 + Math.floor(lines / LINES_PER_LEVEL);
}

function fits(board, p) {
	for (const [cx, cy] of cellsOf(p.type, p.rot)) {
		const x = p.x + cx;
		const y = p.y + cy;
		if (x < 0 || x >= COLS || y < 0 || y >= ROWS || board[y][x]) return false;
	}
	return true;
}

function newBag(rng) {
	const bag = TYPES.slice();
	for (let i = bag.length - 1; i > 0; i--) {
		const j = Math.min(i, Math.floor(rng() * (i + 1)));
		[bag[i], bag[j]] = [bag[j], bag[i]];
	}
	return bag;
}

function draw(s) {
	if (!s.bag.length) s.bag = newBag(s.rng);
	return s.bag.pop();
}

function spawn(s) {
	const type = s.next;
	s.next = draw(s);
	const n = BASE[type].n;
	s.piece = { type, rot: 0, x: Math.floor((COLS - n) / 2), y: 0 };
	if (!fits(s.board, s.piece)) s.over = true;
}

export function createState(rng = Math.random) {
	const s = {
		rng,
		board: Array.from({ length: ROWS }, () => new Array(COLS).fill(0)),
		bag: [], next: null, piece: null,
		score: 0, lines: 0, level: 1, over: false, lastClear: 0,
	};
	s.next = draw(s);
	spawn(s);
	return s;
}

export function move(s, dx) {
	if (s.over) return false;
	const p = { ...s.piece, x: s.piece.x + dx };
	if (!fits(s.board, p)) return false;
	s.piece = p;
	return true;
}

export function rotate(s) {
	if (s.over) return false;
	for (const k of KICKS) {
		const p = { ...s.piece, rot: (s.piece.rot + 1) % 4, x: s.piece.x + k };
		if (fits(s.board, p)) { s.piece = p; return true; }
	}
	return false;
}

function lock(s) {
	for (const [cx, cy] of cellsOf(s.piece.type, s.piece.rot)) {
		s.board[s.piece.y + cy][s.piece.x + cx] = s.piece.type;
	}
	const kept = s.board.filter((row) => row.some((c) => !c));
	const cleared = ROWS - kept.length;
	if (cleared) {
		while (kept.length < ROWS) kept.unshift(new Array(COLS).fill(0));
		s.board = kept;
		s.score += LINE_POINTS[cleared] * s.level;
		s.lines += cleared;
		s.level = levelFor(s.lines);
	}
	s.lastClear = cleared;
	spawn(s);
	return cleared;
}

// One row down. Returns true if it moved (soft drop never locks).
export function softDrop(s) {
	if (s.over) return false;
	const p = { ...s.piece, y: s.piece.y + 1 };
	if (!fits(s.board, p)) return false;
	s.piece = p;
	return true;
}

// Gravity step: move down, or lock when blocked.
export function tick(s) {
	if (s.over) return;
	if (!softDrop(s)) lock(s);
}

export function hardDrop(s) {
	if (s.over) return 0;
	let rows = 0;
	while (softDrop(s)) rows++;
	lock(s);
	return rows;
}

export function ghostY(s) {
	let y = s.piece.y;
	while (fits(s.board, { ...s.piece, y: y + 1 })) y++;
	return y;
}
