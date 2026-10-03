// Quiz questions. Pure data, no DOM.
// Option shape:
//   filter:  { maxTimeMin? , players? , intensity?: [lo, hi] }  -> hard filters
//   targets: { reflexes?, brain?, timeCommitment?, intensity? } -> desired 1-5 values
//   weight:  how much the targets count in similarity (default 1); 0 / no targets = "no preference"

export const FILTER_PRIORITY = ['players', 'time', 'intensity']; // highest first; widening drops from the end

export const AXES = ['reflexes', 'brain', 'timeCommitment', 'intensity'];

export const QUESTIONS = [
	{
		id: 'time',
		prompt: 'The couch is yours. How long before real life comes calling?',
		options: [
			{ id: 'blink', label: 'Barely a coffee break', filter: { maxTimeMin: 15 }, targets: { timeCommitment: 1 }, weight: 1 },
			{ id: 'episode', label: 'About one episode’s worth', filter: { maxTimeMin: 30 }, targets: { timeCommitment: 2 }, weight: 1 },
			{ id: 'evening', label: 'The whole evening is mine', filter: { maxTimeMin: 90 }, targets: { timeCommitment: 4 }, weight: 1 },
			{ id: 'nopref', label: 'No preference — time is a blur', filter: {}, targets: {}, weight: 0 },
		],
	},
	{
		id: 'mind',
		prompt: 'When things go sideways, what saves you?',
		options: [
			{ id: 'reflex', label: 'Fast thumbs and gut instinct', filter: {}, targets: { reflexes: 5, brain: 2 }, weight: 1.5 },
			{ id: 'brain', label: 'A cold, calculated plan', filter: {}, targets: { reflexes: 2, brain: 5 }, weight: 1.5 },
			{ id: 'both', label: 'A bit of both, improvised', filter: {}, targets: { reflexes: 4, brain: 4 }, weight: 1 },
			{ id: 'nopref', label: 'No preference — surprise me', filter: {}, targets: {}, weight: 0 },
		],
	},
	{
		id: 'crew',
		prompt: 'Who’s in your corner tonight?',
		options: [
			{ id: 'solo', label: 'Just me and my headphones', filter: { players: 1 }, targets: {}, weight: 0 },
			{ id: 'duo', label: 'One trusted partner in crime', filter: { players: 2 }, targets: {}, weight: 0 },
			{ id: 'squad', label: 'A loud squad of four-plus', filter: { players: 4 }, targets: {}, weight: 0 },
			{ id: 'nopref', label: 'No preference — whoever shows up', filter: {}, targets: {}, weight: 0 },
		],
	},
	{
		id: 'heat',
		prompt: 'Pick your heart rate.',
		options: [
			{ id: 'chill', label: 'Slow burn, shoulders down', filter: { intensity: [1, 2] }, targets: { intensity: 1 }, weight: 1.5 },
			{ id: 'steady', label: 'Steady pulse, a little tension', filter: { intensity: [2, 4] }, targets: { intensity: 3 }, weight: 1 },
			{ id: 'redline', label: 'Redline — sweaty palms please', filter: { intensity: [4, 5] }, targets: { intensity: 5 }, weight: 1.5 },
			{ id: 'nopref', label: 'No preference — read the room', filter: {}, targets: {}, weight: 0 },
		],
	},
	{
		id: 'hook',
		prompt: 'What should the game do to you?',
		options: [
			{ id: 'snack', label: 'Hand me a quick win and let me go', filter: {}, targets: { timeCommitment: 1, reflexes: 4 }, weight: 1 },
			{ id: 'puzzle', label: 'Make me think, then feel clever', filter: {}, targets: { brain: 5, timeCommitment: 3 }, weight: 1 },
			{ id: 'saga', label: 'Swallow me whole into a long story', filter: {}, targets: { timeCommitment: 5, brain: 3 }, weight: 1.5 },
			{ id: 'nopref', label: 'No preference — entertain me', filter: {}, targets: {}, weight: 0 },
		],
	},
];
