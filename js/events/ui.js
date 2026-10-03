// Events cards. Every tick recomputes from ctx.now(); ticking pauses while the tab is hidden.
import { listEvents, formatCountdown, defaultCtx } from './events.js';

const LABEL = { Upcoming: 'Starts in', Live: 'Ends in', Ended: 'Next in' };

function el(tag, cls, text) {
	const n = document.createElement(tag);
	if (cls) n.className = cls;
	if (text) n.textContent = text;
	return n;
}

export function mountEvents(container, ctx = defaultCtx) {
	let cards = new Map();
	let timer = null;

	function build(ev) {
		const card = el('article', 'hx-event');
		const img = el('img', 'hx-event-img');
		img.src = ev.poster + '-960.webp';
		img.srcset = `${ev.poster}-480.webp 480w, ${ev.poster}-960.webp 960w`;
		img.sizes = '(max-width: 767px) 100vw, 33vw';
		img.alt = ev.title + ' poster';
		img.loading = 'lazy';
		const body = el('div', 'hx-event-body');
		const badges = el('div', 'hx-event-badges');
		const state = el('span', 'hx-badge');
		badges.append(state);
		const title = el('h3', 'hx-event-title', ev.title);
		const when = el('p', 'hx-event-when');
		const count = el('p', 'hx-event-count');
		body.append(badges, title, when, count);
		card.append(img, body);
		return { card, state, when, count };
	}

	function tick() {
		for (const ev of listEvents(ctx)) {
			let c = cards.get(ev.id);
			if (!c) { c = build(ev); cards.set(ev.id, c); container.append(c.card); }
			c.state.textContent = ev.state === 'Live' ? 'LIVE' : ev.state;
			c.state.dataset.state = ev.state;
			c.when.textContent = new Date(ev.startMs).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
			c.count.textContent = LABEL[ev.state] + ' ' + formatCountdown(ev.remainingMs);
		}
	}
	function start() { if (!timer) { tick(); timer = setInterval(tick, 1000); } }
	function stop() { if (timer) { clearInterval(timer); timer = null; } }
	function onVis() { document.hidden ? stop() : start(); }

	document.addEventListener('visibilitychange', onVis);
	if (!document.hidden) start(); else tick();
	return { tick, destroy() { stop(); document.removeEventListener('visibilitychange', onVis); container.textContent = ''; cards = new Map(); } };
}
