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
