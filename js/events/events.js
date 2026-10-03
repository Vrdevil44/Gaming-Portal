// Pure event schedule logic. No DOM. All time reads go through ctx.now().
export const ENDED_WINDOW_MS = 12 * 3600 * 1000;
export const START_HOUR = 19; // every Friday, visitor-local
const FRIDAY = 5;

export const EVENTS = [
	{ id: 'vct', title: 'Valorant Vault Cup', durationMin: 180, poster: 'vct' },
	{ id: 'kpl', title: 'King Clash Friday', durationMin: 120, poster: 'kpl' },
	{ id: 'lpl', title: 'Legends Lockdown Open', durationMin: 150, poster: 'lpl' },
	{ id: 'lll', title: 'Late LobbyLadder', durationMin: 90, poster: 'lll' },
	{ id: 'god', title: 'Gods of the Hideout Brawl', durationMin: 240, poster: 'god' },
];

export const defaultCtx = { now: () => Date.now() };

// Most recent Friday 19:00 (local) at or before `nowMs`, as epoch ms.
export function lastStart(nowMs) {
	const d = new Date(nowMs);
	const back = (d.getDay() - FRIDAY + 7) % 7;
	let s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back, START_HOUR, 0, 0, 0);
	if (s.getTime() > nowMs) s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back - 7, START_HOUR, 0, 0, 0);
	return s.getTime();
}

export function nextStartAfter(startMs) {
	const d = new Date(startMs);
	return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7, START_HOUR, 0, 0, 0).getTime();
}

// -> { state: 'Upcoming'|'Live'|'Ended', startMs, endMs, targetMs, remainingMs }
// Upcoming counts to start, Live counts to end, Ended counts to the next start.
export function eventStatus(ev, ctx = defaultCtx) {
	const now = ctx.now();
	const prev = lastStart(now);
	const prevEnd = prev + ev.durationMin * 60000;
	if (now < prevEnd) return pack('Live', prev, prevEnd, prevEnd, now);
	if (now < prevEnd + ENDED_WINDOW_MS) return pack('Ended', prev, prevEnd, nextStartAfter(prev), now);
	const next = nextStartAfter(prev);
	return pack('Upcoming', next, next + ev.durationMin * 60000, next, now);
}

function pack(state, startMs, endMs, targetMs, now) {
	return { state, startMs, endMs, targetMs, remainingMs: Math.max(0, targetMs - now) };
}

export function listEvents(ctx = defaultCtx) {
	return EVENTS.map((ev) => ({ ...ev, ...eventStatus(ev, ctx) }));
}

export function formatCountdown(ms) {
	const s = Math.floor(Math.max(0, ms) / 1000);
	const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
	const p = (n) => String(n).padStart(2, '0');
	return (d ? d + 'd ' : '') + p(h) + ':' + p(m) + ':' + p(sec);
}
