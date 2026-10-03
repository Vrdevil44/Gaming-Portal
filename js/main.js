import { openGamePanel } from './core/panel.js';
import { snakeDef } from './games/snake/index.js';
import { pongDef } from './games/pong/index.js';
import { tetrisDef } from './games/tetris/index.js';
import { breakoutDef } from './games/breakout/index.js';
import { game2048Def } from './games/2048/index.js';

const gameButtons = [
	['hx-play-snake', snakeDef],
	['hx-play-pong', pongDef],
	['hx-play-tetris', tetrisDef],
	['hx-play-breakout', breakoutDef],
	['hx-play-2048', game2048Def],
];
for (const [id, def] of gameButtons) {
	const btn = document.getElementById(id);
	if (btn) {
		btn.hidden = false;
		btn.addEventListener('click', () => openGamePanel(def));
	}
}

const quizBtn = document.getElementById('hx-quiz');
if (quizBtn) {
	quizBtn.hidden = false;
	quizBtn.addEventListener('click', async () => {
		const { openQuiz } = await import('./quiz/ui.js');
		openQuiz();
	});
}

import { setupModal } from './events/modal.js';
import { mountEvents } from './events/ui.js';

const joinModal = document.getElementById('myModal');
const joinBtn = document.getElementById('myBtn');
if (joinModal && joinBtn) setupModal({ modal: joinModal, openBtn: joinBtn });

const eventsHost = document.getElementById('hx-events');
if (eventsHost) mountEvents(eventsHost);
