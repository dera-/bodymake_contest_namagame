"use strict";

const TITLE_STAGE_INFO = [
	{ name: "予選", difficulty: "簡単", clear: "2位以内", multiplier: 1, background: "stage_preliminary", color: "#ff5aa8" },
	{ name: "準決勝", difficulty: "普通", clear: "2位以内", multiplier: 2, background: "stage_semifinal", color: "#54d9ff" },
	{ name: "決勝", difficulty: "難しい", clear: "1位", multiplier: 5, background: "stage_final", color: "#ffd85d" }
];

function createTitleUi(param) {
	const scene = param.scene;
	const font = param.font;
	let selected = param.initialSelected;
	let tutorialEnabled = param.initialTutorialEnabled !== false;
	const bests = param.bests;
	let countdownFrames = 20 * g.game.fps;
	let started = false;
	const root = new g.E({ scene: scene, width: 1280, height: 720 });
	const titlePage = new g.E({ scene: scene, width: 1280, height: 720 });
	const rulesPage = new g.E({ scene: scene, width: 1280, height: 720, hidden: true });

	function label(parent, text, x, y, size, color, opt) {
		opt = opt || {};
		if (text.indexOf("\n") !== -1) {
			const lines = text.split("\n");
			const lineHeight = opt.lineHeight || Math.ceil(size * 1.25);
			const group = new g.E({
				scene: scene,
				x: x,
				y: y,
				width: opt.width || 1280,
				height: lineHeight * lines.length
			});
			parent.append(group);
			for (let i = 0; i < lines.length; ++i) {
				label(group, lines[i], 0, i * lineHeight, size, color, {
					width: opt.width,
					textAlign: opt.textAlign,
					opacity: opt.opacity
				});
			}
			return group;
		}
		const e = new g.Label({
			scene: scene,
			font: font,
			fontSize: size,
			text: text,
			textColor: color || "#fff",
			x: x,
			y: y,
			width: opt.width,
			anchorX: opt.anchorX,
			textAlign: opt.textAlign,
			lineBreak: !!opt.lineBreak,
			opacity: opt.opacity == null ? 1 : opt.opacity
		});
		parent.append(e);
		return e;
	}

	function rect(parent, x, y, width, height, color, opacity) {
		const e = new g.FilledRect({
			scene: scene, x: x, y: y, width: width, height: height,
			cssColor: color, opacity: opacity == null ? 1 : opacity
		});
		parent.append(e);
		return e;
	}

	function framedPanel(parent, x, y, width, height, fill, border) {
		const panel = new g.E({ scene: scene, x: x, y: y, width: width, height: height });
		rect(panel, 0, 0, width, height, border, 0.95);
		rect(panel, 3, 3, width - 6, height - 6, fill, 0.96);
		rect(panel, 7, 7, width - 14, 2, "#fff", 0.16);
		parent.append(panel);
		return panel;
	}

	function button(parent, x, y, width, height, text, color, onDown) {
		const e = new g.E({ scene: scene, x: x, y: y, width: width, height: height, touchable: true });
		rect(e, 0, 0, width, height, "#070713", 0.88);
		rect(e, 0, 0, width, 4, color, 1);
		rect(e, 0, height - 4, width, 4, color, 1);
		rect(e, 0, 0, 4, height, color, 1);
		rect(e, width - 4, 0, 4, height, color, 1);
		rect(e, 8, 8, width - 16, height - 16, color, 0.13);
		label(e, text, width / 2, 12, 30, "#fff", { anchorX: 0.5 });
		e.onPointDown.add(onDown);
		parent.append(e);
		return e;
	}

	function playSelectSe() {
		if (param.onSelect) param.onSelect();
	}

	function beginGame() {
		if (started) return;
		started = true;
		playSelectSe();
		param.onStart(selected, tutorialEnabled);
	}

	function backdrop(parent) {
		parent.append(new g.Sprite({
			scene: scene,
			src: scene.asset.getImageById("title_backdrop"),
			srcWidth: 1280,
			srcHeight: 720,
			width: 1280,
			height: 720
		}));
		rect(parent, 0, 0, 1280, 720, "#050716", 0.12);
	}

	backdrop(titlePage);

	// Logo: use the existing project asset rather than the reference mockup.
	titlePage.append(new g.Sprite({
		scene: scene,
		src: scene.asset.getImageById("title_logo"),
		srcWidth: 600,
		srcHeight: 338,
		x: 22,
		y: -18,
		width: 470,
		height: 264
	}));

	// Generated speech-bubble art gives the coach dialogue a distinct idol-game frame.
	titlePage.append(new g.Sprite({
		scene: scene,
		src: scene.asset.getImageById("speech_bubble"),
		srcWidth: 610,
		srcHeight: 183,
		x: 585,
		y: 16,
		width: 610,
		height: 183
	}));
	label(titlePage, "あんたは私のコーチだよ！\nステージを選んで、\n最高の私を引き出してくれ！", 625, 42, 24, "#fff", { width: 530, lineBreak: true });

	// A dedicated portrait panel makes the lower crop look intentional.
	const portraitFrame = framedPanel(titlePage, 920, 178, 332, 402, "#080916", "#ff5aa8");
	rect(portraitFrame, 8, 8, 316, 386, "#54d9ff", 0.18);
	portraitFrame.append(new g.Sprite({
		scene: scene,
		src: scene.asset.getImageById("portrait_hero_bust"),
		srcWidth: 312,
		srcHeight: 390,
		x: 10,
		y: 8,
		width: 312,
		height: 390
	}));
	rect(portraitFrame, 8, 392, 316, 4, "#ffd85d", 0.95);

	const cards = [];
	for (let i = 0; i < TITLE_STAGE_INFO.length; ++i) {
		const info = TITLE_STAGE_INFO[i];
		const card = new g.E({ scene: scene, x: 45 + i * 278, y: 214, width: 258, height: 336, touchable: true });
		const glow = rect(card, 0, 0, 258, 336, info.color, 0.15);
		rect(card, 4, 4, 250, 328, "#0a0917", 0.96);
		const borderTop = rect(card, 4, 4, 250, 5, info.color, 0.9);
		rect(card, 4, 327, 250, 5, info.color, 0.9);
		rect(card, 4, 4, 5, 328, info.color, 0.9);
		rect(card, 249, 4, 5, 328, info.color, 0.9);
		label(card, info.name, 129, 18, 30, "#fff", { anchorX: 0.5 });
		const multiplierText = info.multiplier === 1 ? "SCORE ×1" : "SCORE ×" + info.multiplier;
		label(card, multiplierText, 129, 55, 24, info.color, { anchorX: 0.5 });
		card.append(new g.Sprite({
			scene: scene,
			src: scene.asset.getImageById(info.background),
			srcWidth: 986,
			srcHeight: 396,
			x: 15,
			y: 90,
			width: 228,
			height: 92
		}));
		rect(card, 15, 178, 228, 4, info.color, 0.92);
		label(card, "難易度", 22, 205, 24, "#bfaecb");
		label(card, info.difficulty, 235, 205, 24, info.color, { anchorX: 1 });
		label(card, "クリア", 22, 239, 24, "#bfaecb");
		label(card, info.clear, 235, 239, 24, "#fff", { anchorX: 1 });
		const best = bests[i] == null ? "--" : String(Math.floor(bests[i])) + " pt";
		label(card, "BEST", 22, 282, 24, "#ffd85d");
		label(card, best, 235, 282, 24, "#fff", { anchorX: 1 });
		const selectedBadge = new g.E({ scene: scene, x: 126, y: -9, width: 124, height: 34 });
		rect(selectedBadge, 0, 0, 124, 34, info.color, 0.96);
		label(selectedBadge, "選択中", 62, 3, 24, "#090712", { anchorX: 0.5 });
		card.append(selectedBadge);
		card.onPointDown.add((function (index) {
			return function () { playSelectSe(); selected = index; refreshCards(); };
		})(i));
		titlePage.append(card);
		cards.push({ entity: card, glow: glow, borderTop: borderTop, badge: selectedBadge });
	}

	// This control is drawn over the preliminary card after all cards so it owns
	// the pointer hit area instead of being swallowed by the stage card itself.
	const tutorialToggle = new g.E({ scene: scene, x: 64, y: 308, width: 220, height: 68, touchable: true });
	const tutorialToggleBg = rect(tutorialToggle, 0, 0, 220, 68, "#080916", 0.94);
	rect(tutorialToggle, 0, 0, 5, 68, "#ffd85d", 1);
	const tutorialToggleLabel = label(tutorialToggle, "チュートリアル", 110, 1, 24, "#ffd85d", { anchorX: 0.5 });
	rect(tutorialToggle, 8, 32, 204, 30, "#11091a", 0.94);
	rect(tutorialToggle, 28, 34, 26, 26, "#080916", 1);
	rect(tutorialToggle, 28, 34, 26, 3, "#fff", 0.9);
	rect(tutorialToggle, 28, 57, 26, 3, "#fff", 0.9);
	rect(tutorialToggle, 28, 34, 3, 26, "#fff", 0.9);
	rect(tutorialToggle, 51, 34, 3, 26, "#fff", 0.9);
	const tutorialCheck = rect(tutorialToggle, 33, 39, 16, 16, "#ff5aa8", 1);
	const tutorialStatusLabel = label(tutorialToggle, "現在 ON", 67, 33, 24, "#9be44f");
	tutorialToggle.onPointDown.add(function () {
		playSelectSe();
		selected = 0;
		tutorialEnabled = !tutorialEnabled;
		if (param.onTutorialChange) param.onTutorialChange(tutorialEnabled);
		refreshCards();
		refreshTutorialToggle();
	});
	titlePage.append(tutorialToggle);

	function refreshTutorialToggle() {
		if (tutorialEnabled) tutorialCheck.show(); else tutorialCheck.hide();
		tutorialToggleBg.opacity = tutorialEnabled ? 0.96 : 0.78;
		tutorialStatusLabel.text = tutorialEnabled ? "現在 ON" : "現在 OFF";
		tutorialStatusLabel.textColor = tutorialEnabled ? "#9be44f" : "#ff8a95";
		tutorialToggleBg.modified();
		tutorialStatusLabel.invalidate();
	}

	function refreshCards() {
		for (let i = 0; i < cards.length; ++i) {
			const active = i === selected;
			cards[i].glow.opacity = active ? 0.5 : 0.08;
			cards[i].borderTop.height = active ? 9 : 5;
			cards[i].badge.opacity = active ? 1 : 0;
			cards[i].entity.scaleX = active ? 1.025 : 1;
			cards[i].entity.scaleY = active ? 1.025 : 1;
			cards[i].glow.modified();
			cards[i].borderTop.modified();
			cards[i].badge.modified();
			cards[i].entity.modified();
		}
	}

	button(titlePage, 205, 570, 315, 66, "ゲーム開始", "#ff4fa3", function () {
		beginGame();
	});
	button(titlePage, 556, 570, 280, 66, "ルール説明", "#54d9ff", function () {
		playSelectSe();
		titlePage.hide();
		rulesPage.show();
	});
	const titleCountdownPanel = framedPanel(titlePage, 930, 604, 270, 54, "#0b0b18", "#ffd85d");
	const titleCountdownLabel = label(titleCountdownPanel, "自動開始まで 20秒", 135, 10, 24, "#ffd85d", { anchorX: 0.5 });

	// Rules page: structured panels replace the low-contrast callout overlay in the reference.
	backdrop(rulesPage);
	rect(rulesPage, 45, 26, 1190, 650, "#060713", 0.9);
	rect(rulesPage, 45, 26, 1190, 5, "#ff4fa3", 1);
	rect(rulesPage, 45, 671, 1190, 5, "#54d9ff", 1);
	label(rulesPage, "ルール説明", 640, 43, 42, "#fff", { anchorX: 0.5 });
	label(rulesPage, "90秒でスコアを競い、クリア順位を目指そう", 640, 93, 24, "#ffd85d", { anchorX: 0.5 });

	const objective = framedPanel(rulesPage, 75, 132, 360, 178, "#111021", "#ff4fa3");
	label(objective, "1  目的", 22, 14, 30, "#ff6ab2");
	objective.append(new g.Sprite({ scene: scene, src: scene.asset.getImageById("rank_1"), srcWidth: 80, srcHeight: 80, x: 22, y: 64, width: 72, height: 72 }));
	label(objective, "予選 2位以内\n準決勝 2位以内\n決勝 1位", 112, 64, 24, "#fff", { width: 225, lineBreak: true });

	const operation = framedPanel(rulesPage, 455, 132, 750, 178, "#111021", "#54d9ff");
	label(operation, "2  操作", 22, 14, 30, "#54d9ff");
	label(operation, "5秒ごとのターン制。タイミングカーソルを見る", 22, 50, 24, "#fff");
	label(operation, "PERFECT / GOOD を狙ってアクションボタンを押す", 22, 79, 24, "#ffd85d");
	const ruleTimingAssets = ["timing_bad", "timing_normal", "timing_good", "timing_perfect", "timing_good", "timing_normal", "timing_bad"];
	rect(operation, 20, 112, 438, 34, "#fff", 0.9);
	for (let i = 0; i < ruleTimingAssets.length; ++i) {
		operation.append(new g.Sprite({
			scene: scene, src: scene.asset.getImageById(ruleTimingAssets[i]),
			srcWidth: 128, srcHeight: 28, x: 22 + i * 62, y: 115, width: 62, height: 28
		}));
	}
	operation.append(new g.Sprite({
		scene: scene, src: scene.asset.getImageById("timing_cursor"),
		srcWidth: 24, srcHeight: 48, x: 230, y: 109, width: 18, height: 36
	}));
	label(operation, "→", 474, 108, 30, "#54d9ff");
	const ruleActions = ["action_front", "action_back", "action_walk", "action_smile"];
	for (let i = 0; i < ruleActions.length; ++i) {
		operation.append(new g.Sprite({ scene: scene, src: scene.asset.getImageById(ruleActions[i]), srcWidth: 96, srcHeight: 96, x: 515 + i * 53, y: 107, width: 44, height: 44 }));
	}

	const judging = framedPanel(rulesPage, 75, 330, 735, 250, "#111021", "#c178ff");
	label(judging, "3  審査について", 22, 14, 30, "#c178ff");
	const judgeIcons = ["judge_style", "judge_walk", "judge_expression"];
	const judgeTexts = ["FRONT・BACK\nスタイル", "WALK\nウォーク", "SMILE\n表現力"];
	for (let i = 0; i < 3; ++i) {
		judging.append(new g.Sprite({ scene: scene, src: scene.asset.getImageById(judgeIcons[i]), srcWidth: 96, srcHeight: 120, x: 22 + i * 235, y: 64, width: 62, height: 78 }));
		label(judging, judgeTexts[i], 91 + i * 235, 71, 24, "#fff", { width: 138, lineBreak: true });
	}
	label(judging, "審査傾向の上位アクションが有利 (毎ターン変わる)\nゲージ0で交代。交代中は審査なし", 22, 158, 24, "#ffd85d", { lineHeight: 30 });

	const special = framedPanel(rulesPage, 830, 330, 375, 250, "#111021", "#ffd85d");
	label(special, "4  SPECIAL", 22, 14, 30, "#ffd85d");
	rect(special, 25, 67, 325, 24, "#2b2030", 1);
	rect(special, 29, 71, 317, 16, "#ffd85d", 1);
	label(special, "VOLTAGE 100%で発動", 25, 105, 24, "#fff");
	label(special, "全審査へ強力アピール\nBAD・MISSでは増えない", 25, 140, 24, "#ffdf8a", { width: 325, lineBreak: true });

	button(rulesPage, 470, 604, 340, 62, "タイトルへ戻る", "#ff4fa3", function () {
		playSelectSe();
		rulesPage.hide();
		titlePage.show();
	});
	const rulesCountdownPanel = framedPanel(rulesPage, 930, 608, 270, 54, "#0b0b18", "#ffd85d");
	const rulesCountdownLabel = label(rulesCountdownPanel, "自動開始まで 20秒", 135, 10, 24, "#ffd85d", { anchorX: 0.5 });

	root.append(titlePage);
	root.append(rulesPage);
	refreshCards();
	refreshTutorialToggle();
	root.onUpdate.add(function () {
		if (started) return;
		countdownFrames = Math.max(0, countdownFrames - 1);
		const seconds = Math.ceil(countdownFrames / g.game.fps);
		const text = "自動開始まで " + seconds + "秒";
		if (titleCountdownLabel.text !== text) {
			titleCountdownLabel.text = text;
			titleCountdownLabel.invalidate();
			rulesCountdownLabel.text = text;
			rulesCountdownLabel.invalidate();
		}
		if (countdownFrames <= 0) beginGame();
	});
	return root;
}

module.exports = createTitleUi;
