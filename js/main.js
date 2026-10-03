import { openGamePanel } from './core/panel.js';
import { snakeDef } from './games/snake/index.js';

const playSnake = document.getElementById('hx-play-snake');
if (playSnake) {
	playSnake.hidden = false;
	playSnake.addEventListener('click', () => openGamePanel(snakeDef));
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
