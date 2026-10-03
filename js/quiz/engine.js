// Recommender engine. PURE: no DOM, no network, no globals besides ctx.
import { QUESTIONS, FILTER_PRIORITY, AXES } from './questions.js';
import { GAMES } from './db.js';

const DIM_LABEL = {
	reflexes: ['it rewards quick reflexes', 'it goes easy on twitch skill'],
	brain: ['it’s a thinker’s game', 'you can play it without overthinking'],
	timeCommitment: ['it fits the time you’re ready to give', 'it fits the time you’re ready to give'],
	intensity: ['it matches the heat you asked for', 'it matches the heat you asked for'],
};

function hash(str) { // FNV-1a
	let h = 2166136261;
	for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
	return h >>> 0;
}

export function dateSeed(now) {
	return new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// answers: array of option indices (0-3), one per question.
export function resolveAnswers(answers) {
	const filters = {}; // players, time, intensity
	const targets = {}; // axis -> { sum, w }
	QUESTIONS.forEach((q, i) => {
		const o = q.options[answers[i]];
		if (!o) throw new Error(`bad answer for ${q.id}`);
		if (o.filter.players != null) filters.players = o.filter.players;
		if (o.filter.maxTimeMin != null) filters.time = o.filter.maxTimeMin;
		if (o.filter.intensity) filters.intensity = o.filter.intensity;
		for (const [axis, v] of Object.entries(o.targets)) {
			const t = (targets[axis] ||= { sum: 0, w: 0 });
			t.sum += v * o.weight; t.w += o.weight;
		}
	});
	const goals = {};
	for (const [axis, t] of Object.entries(targets)) goals[axis] = { value: t.sum / t.w, weight: t.w };
	return { filters, goals };
}

const PASS = {
	players: (g, n) => n >= g.players[0] && n <= g.players[1],
	time: (g, max) => g.maxTimeMin <= max,
	intensity: (g, [lo, hi]) => g.intensity >= lo && g.intensity <= hi,
};

function gameDim(g, axis) { return axis === 'intensity' ? g.intensity : g.axes[axis]; }

export function applyFilters(games, filters) {
	return games.filter(g => Object.entries(filters).every(([k, v]) => PASS[k](g, v)));
}

function score(g, goals) {
	let total = 0, wsum = 0;
	const dims = [];
	for (const axis of AXES) {
		const goal = goals[axis];
		if (!goal) continue;
		const sim = 1 - Math.abs(gameDim(g, axis) - goal.value) / 4;
		total += sim * goal.weight; wsum += goal.weight;
		dims.push({ axis, sim, weighted: sim * goal.weight, high: goal.value >= 3 });
	}
	return { score: wsum ? total / wsum : 0.5, dims };
}

function reasonFor(game, dims) {
	if (!dims.length) return `${game.title} is a wide-open pick — ${game.desc.charAt(0).toLowerCase()}${game.desc.slice(1)}`;
	const top = [...dims].sort((a, b) => b.weighted - a.weighted || b.sim - a.sim).slice(0, 2);
	const bits = top.map(d => DIM_LABEL[d.axis][d.high ? 0 : 1]);
	return `Pick ${game.title}: ${bits.length > 1 && bits[0] !== bits[1] ? bits.join(' and ') : bits[0]}.`;
}

// ctx: { now: Date|ms, exclude?: string[] (ids already shown), games?: db override }
export function recommend(answers, ctx) {
	const { filters, goals } = resolveAnswers(answers);
	const exclude = new Set(ctx.exclude || []);
	const all = (ctx.games || GAMES).filter(g => !exclude.has(g.id));
	const active = { ...filters };
	const widened = [];
	let pool = applyFilters(all, active);
	for (let i = FILTER_PRIORITY.length - 1; pool.length < 3 && i >= 0; i--) {
		const key = FILTER_PRIORITY[i];
		if (!(key in active)) continue;
		delete active[key];
		widened.push(key);
		pool = applyFilters(all, active);
	}
	if (!pool.length) return { winner: null, reason: '', runnersUp: [], widened, ranking: [] };
	const seed = dateSeed(ctx.now);
	const ranked = pool.map(g => ({ game: g, ...score(g, goals), tie: hash(seed + ':' + g.id) }))
		.sort((a, b) => (Math.abs(b.score - a.score) > 1e-9 ? b.score - a.score : a.tie - b.tie));
	const [w, ...rest] = ranked;
	return {
		winner: w.game,
		reason: reasonFor(w.game, w.dims),
		runnersUp: rest.slice(0, 2).map(r => r.game),
		widened, // e.g. ['intensity'] = that filter was dropped to find results
		ranking: ranked.map(r => r.game.id),
	};
}

// Re-roll: same answers, excluding everything already shown.
export function reroll(answers, ctx, shown) {
	return recommend(answers, { ...ctx, exclude: [...(ctx.exclude || []), ...shown.map(g => g.id || g)] });
}
