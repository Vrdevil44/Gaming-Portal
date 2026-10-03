// Run: node test/tetris.test.mjs   (Node 18+, no dependencies, no browser)
import assert from 'node:assert/strict';
import {
	createState, move, rotate, softDrop, hardDrop, tick, cellsOf, levelFor,
	COLS, ROWS, TYPES, KICKS, LINE_POINTS,
} from '../js/games/tetris/logic.js';

let failed = 0;
function check(name, fn) {
	try { fn(); console.log('PASS', name); } catch (e) { failed++; console.log('FAIL', name, '\n  ', e.message); }
}
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const empty = () => Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
const inBoard = (s) => cellsOf(s.piece.type, s.piece.rot).every(([x, y]) => {
	const px = s.piece.x + x; const py = s.piece.y + y;
	return px >= 0 && px < COLS && py >= 0 && py < ROWS && !s.board[py][px];
});

check('kick list matches spec', () => assert.deepEqual(KICKS, [0, -1, 1, -2, 2]));

check('rotation at walls/floor never overlaps or leaves board', () => {
	for (const type of TYPES) {
		for (let x = -3; x < COLS + 3; x++) {
			for (const y of [0, 5, ROWS - 4, ROWS - 2]) {
				for (let rot = 0; rot < 4; rot++) {
					const s = createState(lcg(1));
					s.piece = { type, rot, x, y };
					if (!inBoard(s)) continue; // only legal starting positions
					for (let i = 0; i < 6; i++) { rotate(s); assert.ok(inBoard(s), `${type} x${x} y${y} r${rot}`); }
				}
			}
		}
	}
});

check('I piece vertical at left wall rotates via kick', () => {
	const s = createState(lcg(2));
	s.piece = { type: 'I', rot: 1, x: -2, y: 5 }; // vertical, column x=1
	assert.ok(inBoard(s));
	assert.ok(rotate(s));
	assert.ok(inBoard(s));
});

check('rotation blocked by stack returns false and keeps piece', () => {
	const s = createState(lcg(3));
	s.board = Array.from({ length: ROWS }, () => new Array(COLS).fill('X'));
	s.piece = { type: 'T', rot: 0, x: 3, y: 0 };
	for (const [x, y] of cellsOf('T', 0)) s.board[y][3 + x] = 0;
	assert.equal(rotate(s), false);
	assert.equal(s.piece.rot, 0);
});

function clearTest(n) {
	const s = createState(lcg(4));
	s.board = empty();
	// bottom n rows full except column 0..3 gap where a vertical I will land
	for (let r = ROWS - n; r < ROWS; r++) for (let c = 1; c < COLS; c++) s.board[r][c] = 'X';
	s.piece = { type: 'I', rot: 1, x: -3, y: 0 }; // vertical, column 0
	assert.ok(inBoard(s));
	hardDrop(s);
	return s;
}
[1, 2, 3, 4].forEach((n) => check(`clear ${n} line(s) scores ${LINE_POINTS[n]} x level`, () => {
	const s = clearTest(n);
	assert.equal(s.lines, n);
	assert.equal(s.score, LINE_POINTS[n]);
	const l = createState(lcg(4));
	l.level = 3; l.lines = 20; l.board = empty();
	for (let r = ROWS - n; r < ROWS; r++) for (let c = 1; c < COLS; c++) l.board[r][c] = 'X';
	l.piece = { type: 'I', rot: 1, x: -3, y: 0 };
	hardDrop(l);
	assert.equal(l.score, LINE_POINTS[n] * 3);
}));

check('7-bag: each consecutive 7 pieces contain one of each', () => {
	const s = createState(lcg(5));
	const seq = [s.piece.type];
	// walk the sequence via next-piece, locking each piece at once
	for (let i = 0; i < 70; i++) { seq.push(s.next); s.piece = { ...s.piece, y: 0 }; s.board = empty(); hardDrop(s); }
	for (let i = 0; i + 7 <= seq.length; i += 7) {
		assert.deepEqual([...seq.slice(i, i + 7)].sort(), [...TYPES].sort(), `bag ${i / 7}`);
	}
});

check('spawn collision ends game', () => {
	const s = createState(lcg(6));
	s.board = empty();
	for (let c = 1; c < COLS; c++) { s.board[0][c] = 'X'; s.board[1][c] = 'X'; } // gaps keep rows from clearing
	s.piece = { type: 'O', rot: 0, x: 4, y: 5 };
	hardDrop(s); // lock; the next spawn lands on the filled rows
	assert.equal(s.over, true);
	const before = s.score;
	tick(s); move(s, 1); rotate(s); hardDrop(s);
	assert.equal(s.score, before);
});

check('stacking to the top ends game via normal play', () => {
	const s = createState(lcg(7));
	for (let i = 0; i < 100 && !s.over; i++) hardDrop(s);
	assert.equal(s.over, true);
});

check('level progression: every 10 lines', () => {
	assert.equal(levelFor(0), 1);
	assert.equal(levelFor(9), 1);
	assert.equal(levelFor(10), 2);
	assert.equal(levelFor(25), 3);
	const s = clearTest(4);
	s.lines = 8; s.board = empty();
	for (let r = ROWS - 2; r < ROWS; r++) for (let c = 1; c < COLS; c++) s.board[r][c] = 'X';
	s.piece = { type: 'I', rot: 1, x: -3, y: 0 };
	hardDrop(s);
	assert.equal(s.lines, 10);
	assert.equal(s.level, 2);
});

check('soft drop moves one row; hard drop lands and locks', () => {
	const s = createState(lcg(8));
	const y = s.piece.y;
	assert.ok(softDrop(s));
	assert.equal(s.piece.y, y + 1);
	const rows = hardDrop(s);
	assert.ok(rows > 0);
	assert.ok(s.board.some((r) => r.some(Boolean)));
});

check('deterministic with same rng; pure module has no DOM', () => {
	const a = createState(lcg(9)); const b = createState(lcg(9));
	assert.equal(a.piece.type, b.piece.type);
	assert.equal(a.next, b.next);
});

console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
