"use strict";

// BODYMAKE CONTEST - one-stage realtime ranking prototype

const instanceStorage = require("@akashic-extension/instance-storage").instanceStorage;
const createTitleUi = require("bodymake-title");
const createLoadingScene = require("bodymake-loading");

const STORAGE_KEY = "shiny_muscle";
const STAGE_CONFIGS = [
	{
		name: "予選", difficulty: "簡単", background: "stage_preliminary", bgm: "bgm_preliminary",
		clearRank: 3, scoreMultiplier: 1, aiPower: 0.90, aiAdapt: 0.75, aiTimingError: 1.00, timingSpeed: 1.00,
		perfectWidth: 1.00, goodWidth: 1.00, normalWidth: 1.00, judgeGauge: 1.08,
		aiVoltage: [0, 0, 0, 0, 50, 80], aiVoltageGain: 1.20, aiSpecialMax: [0, 0, 0, 0, 1, 2],
		aiSpecialTurns: [[], [], [], [], [10], [5, 14]]
	},
	{
		name: "準決勝", difficulty: "普通", background: "stage_semifinal", bgm: "bgm_semifinal",
		clearRank: 2, scoreMultiplier: 2, aiPower: 1.00, aiAdapt: 1.06, aiTimingError: 1.00, timingSpeed: 1.00,
		perfectWidth: 1.00, goodWidth: 1.00, normalWidth: 1.00, judgeGauge: 1.00,
		aiVoltage: [0, 0, 0, 0, 72, 90], aiVoltageGain: 1.35, aiSpecialMax: [0, 0, 0, 0, 2, 2],
		aiSpecialTurns: [[], [], [], [], [7, 16], [4, 12]]
	},
	{
		name: "決勝", difficulty: "難しい", background: "stage_final", bgm: "bgm_final",
		clearRank: 1, scoreMultiplier: 5, aiPower: 1.03, aiAdapt: 1.15, aiTimingError: 0.72, timingSpeed: 1.00,
		perfectWidth: 1.00, goodWidth: 1.00, normalWidth: 1.00, judgeGauge: 0.92,
		aiVoltage: [0, 0, 0, 0, 85, 98], aiVoltageGain: 1.40, aiSpecialMax: [0, 0, 0, 0, 3, 3],
		aiSpecialTurns: [[], [], [], [], [6, 12, 18], [3, 9, 15]]
	}
];

const CHARACTER_KEYS = ["hero", "mob_blue", "mob_green", "mob_purple", "rival", "champion"];
const CHARACTER_MOTIONS = ["idle", "front", "back", "walk", "smile", "special"];
const ACTION_MOTIONS = ["front", "back", "walk", "smile"];
const RANK_ASSET_IDS = ["rank_1", "rank_2", "rank_3", "rank_4", "rank_5", "rank_6"];
const TIMING_ZONE_ASSET_IDS = ["timing_bad", "timing_normal", "timing_good", "timing_perfect", "timing_good", "timing_normal", "timing_bad"];
const ACTION_RESULT_ASSET_IDS = {
	PERFECT: "result_perfect", GOOD: "result_good", NORMAL: "result_normal", BAD: "result_bad", MISS: "result_miss"
};
const TIMING_SE_ASSET_IDS = {
	PERFECT: "se_timing_perfect", GOOD: "se_timing_good", NORMAL: "se_timing_normal", BAD: "se_timing_bad"
};
const SPECIAL_PORTRAIT_ASSET_IDS = {
	0: "portrait_hero_special",
	4: "portrait_rival_special",
	5: "portrait_champion_special"
};
const CHARACTER_FRAME_WIDTH = 192;
const CHARACTER_FRAME_HEIGHT = 288;
// SPECIAL sheets include extra room for raised arms, so drawing them at the
// same sheet scale makes the contestant's body look smaller. These values
// normalize the first SPECIAL pose to each character's idle body height.
const SPECIAL_MOTION_SCALES = [262 / 234, 241 / 233, 241 / 233, 241 / 233, 261 / 236, 263 / 224];
const CHARACTER_SPRITE_CENTER_X = 50;
const CHARACTER_SPRITE_BOTTOM_Y = 300;
// VOLTAGE is displayed as an integer percentage. Values that visually round
// to 100% must also be treated as full so the UI and SPECIAL availability agree.
const PLAYER_VOLTAGE_READY_THRESHOLD = 99.5;
const CHARACTER_ASSET_IDS = [];
for (let characterIndex = 0; characterIndex < CHARACTER_KEYS.length; ++characterIndex) {
	for (let motionIndex = 0; motionIndex < CHARACTER_MOTIONS.length; ++motionIndex) {
		if (CHARACTER_MOTIONS[motionIndex] === "special" && characterIndex >= 1 && characterIndex <= 3) continue;
		CHARACTER_ASSET_IDS.push("image/characters/" + CHARACTER_KEYS[characterIndex] + "/" + CHARACTER_MOTIONS[motionIndex] + ".png");
	}
}
const UI_ASSET_IDS = [
	"judge_style", "judge_walk", "judge_expression",
	"action_front", "action_back", "action_walk", "action_smile",
	"stage_preliminary", "stage_semifinal", "stage_final",
	"title_backdrop", "title_logo", "speech_bubble", "portrait_hero_bust",
	"portrait_hero_bust_happy", "portrait_hero_bust_frustrated",
	"rank_1", "rank_2", "rank_3", "rank_4", "rank_5", "rank_6",
	"portrait_hero_special", "portrait_rival_special", "portrait_champion_special",
	"timing_bad", "timing_normal", "timing_good", "timing_perfect", "timing_frame", "timing_cursor",
	"result_perfect", "result_good", "result_normal", "result_bad", "result_miss",
	"game_font_atlas", "game_font_map"
];
const AUDIO_ASSET_IDS = [
	"bgm_opening", "bgm_preliminary", "bgm_semifinal", "bgm_final",
	"me_victory", "me_defeat",
	"se_timing_perfect", "se_timing_good", "se_timing_normal", "se_timing_bad",
	"se_miss", "se_voltage_max", "se_special_player", "se_special_opponent",
	"se_judge_leave", "se_judge_add", "se_turn_start"
];
const GAME_ASSET_IDS = CHARACTER_ASSET_IDS.concat(UI_ASSET_IDS, AUDIO_ASSET_IDS);

function characterAssetId(actorIndex, motion) {
	return "image/characters/" + CHARACTER_KEYS[actorIndex] + "/" + motion + ".png";
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function shuffle(a, random) {
	for (let i = a.length - 1; i > 0; --i) {
		const j = Math.floor(random.generate() * (i + 1));
		const t = a[i]; a[i] = a[j]; a[j] = t;
	}
	return a;
}
function pad2(v) { return (v < 10 ? "0" : "") + v; }
function format(v) {
	const s = String(Math.max(0, Math.floor(v)));
	let out = "";
	for (let i = 0; i < s.length; ++i) {
		if (i && (s.length - i) % 3 === 0) out += ",";
		out += s.charAt(i);
	}
	return out;
}
function normalizeStorageData(value) {
	if (value && value.shiny_muscle) value = value.shiny_muscle;
	const out = { selected: null, bests: [null, null, null] };
	if (!value || typeof value !== "object") return out;
	if (value.selected === 0 || value.selected === 1 || value.selected === 2) out.selected = value.selected;
	if (Array.isArray(value.bests)) {
		for (let i = 0; i < 3; ++i) {
			const score = value.bests[i];
			if (typeof score === "number" && isFinite(score) && score >= 0) out.bests[i] = Math.floor(score);
		}
	}
	return out;
}
function storageSnapshot(data) {
	return { selected: data.selected, bests: data.bests.slice(0, 3) };
}
function createLabel(scene, parent, font, text, x, y, color, opt) {
	opt = opt || {};
	const e = new g.Label({
		scene: scene, font: font.face || font, fontSize: opt.size || font.size, text: text,
		textColor: color || "#fff", x: x, y: y, width: opt.width,
		anchorX: opt.anchorX, textAlign: opt.textAlign, lineBreak: !!opt.lineBreak,
		opacity: opt.opacity == null ? 1 : opt.opacity
	});
	parent.append(e);
	return e;
}
function createPanel(scene, parent, x, y, w, h, fill, border, opacity) {
	const e = new g.E({ scene: scene, x: x, y: y, width: w, height: h });
	e.append(new g.FilledRect({ scene: scene, width: w, height: h, cssColor: fill, opacity: opacity == null ? 1 : opacity }));
	e.append(new g.FilledRect({ scene: scene, width: w, height: 2, cssColor: border }));
	e.append(new g.FilledRect({ scene: scene, y: h - 2, width: w, height: 2, cssColor: border }));
	e.append(new g.FilledRect({ scene: scene, width: 2, height: h, cssColor: border }));
	e.append(new g.FilledRect({ scene: scene, x: w - 2, width: 2, height: h, cssColor: border }));
	parent.append(e);
	return e;
}
function createBar(scene, parent, x, y, w, h, back, color) {
	const e = new g.E({ scene: scene, x: x, y: y, width: w, height: h });
	e.append(new g.FilledRect({ scene: scene, width: w, height: h, cssColor: back }));
	const fill = new g.FilledRect({ scene: scene, x: 2, y: 2, width: w - 4, height: h - 4, cssColor: color });
	e.append(fill); parent.append(e);
	return { fill: fill, max: w - 4 };
}

function main(param) {
	g.game.loadingScene = createLoadingScene();
	const scene = new g.Scene({ game: g.game, assetIds: GAME_ASSET_IDS });
	let storedData = normalizeStorageData(null);
	g.game.vars.gameState = { score: 0 };

	scene.onLoad.add(function () {
		const random = param.random || g.game.random;
		const FPS = g.game.fps;
		const TURN_SECONDS = 5;
		const TOTAL_TURNS = 18;
		let selectedStageIndex = storedData.selected == null ? 0 : storedData.selected;
		let currentStage = STAGE_CONFIGS[selectedStageIndex];
		let bgmPlayer = null;
		let openingBgmPlayer = null;
		function startOpeningBgm() {
			if (openingBgmPlayer) return;
			openingBgmPlayer = scene.asset.getAudioById("bgm_opening").play();
			if (openingBgmPlayer && openingBgmPlayer.changeVolume) openingBgmPlayer.changeVolume(0.13);
		}
		function stopOpeningBgm() {
			if (!openingBgmPlayer) return;
			openingBgmPlayer.stop();
			openingBgmPlayer = null;
		}
		function startStageBgm(assetId) {
			if (bgmPlayer) bgmPlayer.stop();
			bgmPlayer = scene.asset.getAudioById(assetId).play();
			if (bgmPlayer && bgmPlayer.changeVolume) bgmPlayer.changeVolume(0.13);
		}
		function playSe(assetId, volume) {
			const player = scene.asset.getAudioById(assetId).play();
			if (player && player.changeVolume) player.changeVolume((volume == null ? 0.72 : volume) * 0.68);
			return player;
		}
		function writeStoredData() {
			instanceStorage.write(STORAGE_KEY, storageSnapshot(storedData)).catch(function () {
				// Storage is optional and may be unavailable on the current platform.
			});
		}
		const C = {
			bg: "#080510", panel: "#160d22", line: "#a93673", pink: "#ff3e9e",
			gold: "#ffd85d", cyan: "#54d9ff", muted: "#bfaecb", purple: "#c178ff",
			green: "#9be44f", danger: "#ff5b66"
		};
		const gameFontData = JSON.parse(scene.asset.getTextById("game_font_map").data);
		const gameFont = new g.BitmapFont({
			src: scene.asset.getImageById("game_font_atlas"),
			map: gameFontData.map,
			defaultGlyphWidth: gameFontData.defaultGlyphWidth,
			defaultGlyphHeight: gameFontData.defaultGlyphHeight,
			missingGlyph: gameFontData.map["63"]
		});
		const f52 = { face: gameFont, size: 52 };
		const f42 = { face: gameFont, size: 42 };
		const f30 = { face: gameFont, size: 30 };
		const f25 = { face: gameFont, size: 25 };
		const f20 = { face: gameFont, size: 24 };
		const f16 = { face: gameFont, size: 24 };

		const axes = [
			{ label: "スタイル", trend: "スタイル", color: C.pink },
			{ label: "ウォーキング", trend: "ウォーク", color: C.cyan },
			{ label: "表現力", trend: "表現力", color: C.purple }
		];
		const actions = [
			{ label: "FRONT", advantage: "スタイル", base: [120, 80, 60], color: "#ff5aa8", icon: "action_front" },
			{ label: "BACK", advantage: "スタイル", base: [140, 50, 80], color: "#d92f7d", icon: "action_back" },
			{ label: "WALK", advantage: "ウォーク", base: [60, 140, 100], color: "#32bfe5", icon: "action_walk" },
			{ label: "SMILE", advantage: "表現力", base: [50, 80, 150], color: "#a65de5", icon: "action_smile" }
		];
		const actors = [
			{ no: 1, name: "PLAYER", color: "#ef493f", stats: [1, 1, 1] },
			{ no: 2, name: "BLUE GIRL", color: "#277fae", stats: [1, 1, 1], favorite: 0, adapt: 0.45, timing: "steady", special: false, voltage: 0 },
			{ no: 3, name: "GREEN GIRL", color: "#51aa55", stats: [1.38, 0.82, 0.88], favorite: 1, adapt: 0.62, timing: "middle", special: false, voltage: 0 },
			{ no: 4, name: "PURPLE GIRL", color: "#9c49bf", stats: [0.86, 1.38, 1], favorite: 2, adapt: 0.58, timing: "early", special: false, voltage: 0 },
			{ no: 5, name: "RIVAL", color: "#26a9a0", stats: [1, 1, 1], favorite: 3, adapt: 0.72, timing: "rival", special: true, voltage: 42 },
			{ no: 6, name: "CHAMPION", color: "#e29e24", stats: [1.1, 1.1, 1.1], favorite: 1, adapt: 0.84, timing: "sniper", special: true, voltage: 65 }
		];

		let timingDifficulty = 0;
		function timingConfig() {
			return {
				period: (1.4 - timingDifficulty * 0.08) / currentStage.timingSpeed,
				perfect: Math.max(0.045, (0.085 - timingDifficulty * 0.005) * currentStage.perfectWidth),
				good: Math.max(0.13, (0.24 - timingDifficulty * 0.01) * currentStage.goodWidth),
				normal: Math.max(0.29, (0.4 - timingDifficulty * 0.01) * currentStage.normalWidth)
			};
		}
		function timingPositionAt(seconds) {
			const period = timingConfig().period;
			const p = (seconds % period) / period;
			return p < 0.5 ? p * 2 : (1 - p) * 2;
		}
		function judgeTiming(pos) {
			const config = timingConfig();
			const d = Math.abs(pos - 0.5);
			if (d <= config.perfect) return { name: "PERFECT", multi: 1.45, voltage: 16 };
			if (d <= config.good) return { name: "GOOD", multi: 1.2, voltage: 11 };
			if (d <= config.normal) return { name: "NORMAL", multi: 1, voltage: 7 };
			return { name: "BAD", multi: 0.7, voltage: 0 };
		}
		function levelGauge(level) { return Math.round(1800 * currentStage.judgeGauge * (1 + (level - 1) * 0.15)); }
		function levelMulti(level) { return 1 + (level - 1) * 0.12; }

		// Background.
		scene.append(new g.FilledRect({ scene: scene, width: 1280, height: 720, cssColor: C.bg }));
		scene.append(new g.FilledRect({ scene: scene, width: 1280, height: 6, cssColor: C.pink }));
		for (let i = 0; i < 7; ++i) scene.append(new g.FilledRect({
			scene: scene, x: 92 + i * 148, y: 145, width: 3, height: 390,
			cssColor: i % 2 ? C.cyan : C.pink, opacity: 0.14, angle: i % 2 ? 10 : -10
		}));

		// Judge row.
		const judgeTitles = ["スタイル審査", "ウォーク審査", "表現力審査"];
		const judgeAssetIds = ["judge_style", "judge_walk", "judge_expression"];
		const judgeUi = [];
		for (let i = 0; i < 3; ++i) {
			const p = createPanel(scene, scene, 12 + i * 244, 14, 236, 142, C.panel, axes[i].color, 0.98);
			p.append(new g.Sprite({
				scene: scene, src: scene.asset.getImageById(judgeAssetIds[i]),
				srcX: 0, srcY: 0, srcWidth: 96, srcHeight: 120,
				x: 160, y: 24, width: 70, height: 88, opacity: 0.7
			}));
			createLabel(scene, p, f25, judgeTitles[i], 10, 5, "#fff");
			const lv = createLabel(scene, p, f20, "Lv1", 226, 7, C.gold, { anchorX: 1 });
			const initialLines = ["立ち姿を見せて", "さあ、歩いて！", "笑顔で魅せて"];
			const comment = createLabel(scene, p, f16, initialLines[i], 10, 44, C.muted);
			const gauge = createBar(scene, p, 10, 104, 216, 20, "#0b0711", axes[i].color);
			judgeUi.push({ panel: p, lv: lv, comment: comment, gauge: gauge, depart: 0, enter: 0 });
		}
		const trendPanel = createPanel(scene, scene, 744, 14, 254, 142, "#100919", C.line, 0.97);
		// Clip the title to suppress a tiny atlas-edge artifact after the last glyph.
		const trendTitleClip = new g.Pane({ scene: scene, x: 10, y: 4, width: 116, height: 32 });
		trendPanel.append(trendTitleClip);
		createLabel(scene, trendTitleClip, f16, "審査傾向", 2, 3, C.muted);
		const trendLabels = [];
		for (let i = 0; i < 3; ++i) trendLabels.push(createLabel(scene, trendPanel, f16, "", 12, 48 + i * 31, "#fff"));
		// Draw this after the values to cover their filtered pixels leaking into the title row.
		trendPanel.append(new g.FilledRect({ scene: scene, x: 124, y: 4, width: 118, height: 44, cssColor: "#100919" }));

		// Stage. The selected title-screen stage is applied before the countdown.
		const stageBackground = new g.Sprite({
			scene: scene, src: scene.asset.getImageById("stage_preliminary"),
			x: 12, y: 164, width: 986, height: 396, opacity: 0.8
		});
		scene.append(stageBackground);
		const stage = createPanel(scene, scene, 12, 164, 986, 396, "#220c31", C.line, 0.36);
		stage.append(new g.FilledRect({ scene: scene, x: 2, y: 2, width: 982, height: 52, cssColor: "#320b42", opacity: 0.72 }));
		stage.append(new g.FilledRect({ scene: scene, x: 2, y: 350, width: 982, height: 44, cssColor: "#241127", opacity: 0.4 }));
		const stagePhaseLabel = createLabel(scene, stage, f16, "予選", 14, 9, C.gold);
		const nextTurnLabel = createLabel(scene, stage, f16, "開始まで 3秒", 972, 9, C.cyan, { anchorX: 1 });

		function createContestant(actorIndex, x) {
			const a = actors[actorIndex];
			const e = new g.E({ scene: scene, x: x, y: 52, width: 100, height: 340 });
			if (actorIndex === 0) {
				e.append(new g.FilledRect({ scene: scene, x: -30, y: 8, width: 160, height: 306, cssColor: C.pink, opacity: 0.1 }));
				e.append(new g.FilledRect({ scene: scene, x: -30, y: 8, width: 160, height: 4, cssColor: C.pink, opacity: 0.9 }));
				// Leave a notch for the rank medal so the player frame never crosses it.
				e.append(new g.FilledRect({ scene: scene, x: -30, y: 310, width: 26, height: 4, cssColor: C.pink, opacity: 0.9 }));
				e.append(new g.FilledRect({ scene: scene, x: 40, y: 310, width: 90, height: 4, cssColor: C.pink, opacity: 0.9 }));
				e.append(new g.FilledRect({ scene: scene, x: -30, y: 8, width: 4, height: 306, cssColor: C.pink, opacity: 0.9 }));
				e.append(new g.FilledRect({ scene: scene, x: 126, y: 8, width: 4, height: 306, cssColor: C.pink, opacity: 0.9 }));
			}
			const sprite = new g.Sprite({
				scene: scene,
				src: scene.asset.getImageById(characterAssetId(actorIndex, "idle")),
				srcX: 0, srcY: 0, srcWidth: CHARACTER_FRAME_WIDTH, srcHeight: CHARACTER_FRAME_HEIGHT,
				width: 192, height: 288, x: -46, y: 12
			});
			e.append(sprite);
			if (actorIndex === 0) {
				e.append(new g.FilledRect({ scene: scene, x: -30, y: -2, width: 160, height: 30, cssColor: C.pink, opacity: 0.96 }));
				createLabel(scene, e, f16, "▼ No.1 操作", 50, -1, "#fff", { anchorX: 0.5 });
			} else {
				e.append(new g.FilledRect({ scene: scene, x: 14, y: 0, width: 72, height: 28, cssColor: a.color, opacity: 0.95 }));
				createLabel(scene, e, f16, "No." + a.no, 50, 0, "#fff", { anchorX: 0.5 });
			}
			const rankSprite = new g.Sprite({ scene: scene, src: scene.asset.getImageById("rank_1"), srcX: 0, srcY: 0, srcWidth: 80, srcHeight: 80, x: 0, y: 304, width: 36, height: 36 });
			e.append(rankSprite);
			stage.append(e);
			return {
				entity: e, sprite: sprite, rankSprite: rankSprite, baseY: 52,
				motion: "idle", frame: 0, animationElapsed: 0, animationLeft: 0, idleElapsed: actorIndex * 0.11, acted: false
			};
		}
		const actorX = [360, 32, 196, 524, 688, 852];
		const actorUi = [];
		for (let i = 0; i < 6; ++i) actorUi.push(createContestant(i, actorX[i]));

		function setActorFrame(ui, frame) {
			if (ui.frame === frame) return;
			ui.frame = frame;
			ui.sprite.srcX = frame * CHARACTER_FRAME_WIDTH;
			ui.sprite.invalidate();
		}

		function setActorMotion(actorIndex, motion, isAction) {
			const ui = actorUi[actorIndex];
			if (ui.motion !== motion) {
				ui.motion = motion;
				ui.sprite.src = scene.asset.getImageById(characterAssetId(actorIndex, motion));
				ui.frame = -1;
			}
			ui.animationElapsed = 0;
			ui.animationLeft = isAction ? 1.25 : 0;
			const motionScale = motion === "special" ? SPECIAL_MOTION_SCALES[actorIndex] : 1;
			ui.sprite.scaleX = motionScale;
			ui.sprite.scaleY = motionScale;
			// Keep the contestant's horizontal center and feet fixed while scaling.
			ui.sprite.x = CHARACTER_SPRITE_CENTER_X - CHARACTER_FRAME_WIDTH * motionScale / 2;
			ui.sprite.y = CHARACTER_SPRITE_BOTTOM_Y - CHARACTER_FRAME_HEIGHT * motionScale;
			ui.sprite.opacity = isAction ? 1 : (ui.acted ? 0.5 : 1);
			ui.sprite.modified();
			setActorFrame(ui, 0);
		}

		function playActorAnimation(actorIndex, actionIndex, special) {
			setActorMotion(actorIndex, special ? "special" : ACTION_MOTIONS[actionIndex], true);
		}

		function updateActorAnimations(dt) {
			for (let i = 0; i < actorUi.length; ++i) {
				const ui = actorUi[i];
				if (ui.animationLeft > 0) {
					ui.animationElapsed += dt;
					ui.animationLeft -= dt;
					setActorFrame(ui, Math.min(3, Math.floor(ui.animationElapsed / 0.28)));
					if (ui.animationLeft <= 0) setActorMotion(i, "idle", false);
				} else {
					ui.idleElapsed += dt;
					setActorFrame(ui, Math.floor(ui.idleElapsed / 0.32) % 4);
				}
			}
		}

		// Status rail.
		const status = createPanel(scene, scene, 1010, 14, 258, 694, "#100a17", C.line, 1);
		createLabel(scene, status, f20, "TIME", 18, 12, C.pink);
		const timeLabel = createLabel(scene, status, f52, "01:30", 18, 38, "#fff");
		const turnLabel = createLabel(scene, status, f16, "TURN 0 / 18", 18, 96, C.muted);
		status.append(new g.FilledRect({ scene: scene, x: 16, y: 128, width: 226, height: 2, cssColor: C.line, opacity: 0.65 }));
		createLabel(scene, status, f20, "SCORE", 18, 140, C.pink);
		const scoreLabel = createLabel(scene, status, f42, "0 pt", 18, 168, "#ff8dcc");
		status.append(new g.FilledRect({ scene: scene, x: 16, y: 222, width: 226, height: 2, cssColor: C.line, opacity: 0.65 }));
		createLabel(scene, status, f20, "VOLTAGE", 18, 236, C.cyan);
		const voltageText = createLabel(scene, status, f16, "0%", 238, 236, "#fff", { anchorX: 1 });
		const voltageBar = createBar(scene, status, 18, 270, 220, 20, "#0b0711", C.gold);
		status.append(new g.FilledRect({ scene: scene, x: 16, y: 318, width: 226, height: 2, cssColor: C.line, opacity: 0.65 }));
		createLabel(scene, status, f20, "COMBO", 18, 330, C.pink);
		const comboLabel = createLabel(scene, status, f30, "0", 238, 324, C.gold, { anchorX: 1 });
		const comboGaugeEffect = createLabel(scene, status, f16, "速度↑ 幅↓ Lv0", 18, 362, C.cyan);
		const comboScoreEffect = createLabel(scene, status, f16, "アピール x1.00", 18, 391, C.gold);
		status.append(new g.FilledRect({ scene: scene, x: 16, y: 422, width: 226, height: 2, cssColor: C.line, opacity: 0.65 }));
		createLabel(scene, status, f20, "RANKING", 18, 436, C.pink);
		const passBadgeBg = new g.FilledRect({ scene: scene, x: 145, y: 432, width: 95, height: 32, cssColor: C.green, opacity: 0.82 });
		status.append(passBadgeBg);
		const passBadgeLabel = createLabel(scene, status, f16, "1位圏内", 192, 434, "#fff", { anchorX: 0.5 });
		const miniRankIcons = [];
		const miniLabels = [];
		for (let i = 0; i < 6; ++i) {
			const y = 474 + i * 30;
			const icon = new g.Sprite({ scene: scene, src: scene.asset.getImageById(RANK_ASSET_IDS[i]), srcX: 0, srcY: 0, srcWidth: 80, srcHeight: 80, x: 18, y: y - 2, width: 28, height: 28 });
			status.append(icon); miniRankIcons.push(icon);
			miniLabels.push(createLabel(scene, status, f16, "", 52, y, C.muted));
		}
		const qualificationLine = new g.FilledRect({ scene: scene, x: 48, y: 500, width: 190, height: 2, cssColor: C.gold, opacity: 0.9 });
		status.append(qualificationLine);
		const rankGapPane = new g.Pane({ scene: scene, x: 16, y: 654, width: 226, height: 34 });
		status.append(rankGapPane);
		const rankGapLabel = createLabel(scene, rankGapPane, f16, "", 0, 6, C.gold, { width: 226, textAlign: g.TextAlign.Center });

		// Action console. Keep the timing display above the touchable controls so a
		// player's hand does not cover it; the upward-pointing instruction sits below.
		const controls = createPanel(scene, scene, 12, 562, 986, 146, "#0c0812", C.line, 1);
		const judgmentLabel = createLabel(scene, controls, f20, "▲タイミングよくいずれかのアクションを選択", 493, 115, C.gold, { anchorX: 0.5 });
		const timingX = 28, timingY = 7, timingW = 930;
		const zoneNames = ["BAD", "NORMAL", "GOOD", "PERFECT", "GOOD", "NORMAL", "BAD"];
		const timingZones = [];
		for (let i = 0; i < 7; ++i) {
			const rect = new g.Sprite({
				scene: scene, src: scene.asset.getImageById(TIMING_ZONE_ASSET_IDS[i]),
				srcX: 0, srcY: 0, srcWidth: 128, srcHeight: 28,
				x: timingX, y: timingY - 6, width: 128, height: 32, scaleX: 0.1
			});
			controls.append(rect);
			const label = createLabel(scene, controls, f16, zoneNames[i], timingX, timingY - 5, i === 3 ? "#3a2600" : "#fff", { anchorX: 0.5 });
			timingZones.push({ rect: rect, label: label });
		}
		// A one-pixel frame keeps every colored segment inside without dimming it.
		controls.append(new g.FilledRect({ scene: scene, x: 24, y: 0, width: 938, height: 1, cssColor: "#f8e9ff" }));
		controls.append(new g.FilledRect({ scene: scene, x: 24, y: 33, width: 938, height: 1, cssColor: "#f8e9ff" }));
		controls.append(new g.FilledRect({ scene: scene, x: 24, y: 0, width: 1, height: 34, cssColor: "#f8e9ff" }));
		controls.append(new g.FilledRect({ scene: scene, x: 961, y: 0, width: 1, height: 34, cssColor: "#f8e9ff" }));
		const cursor = new g.Sprite({
			scene: scene, src: scene.asset.getImageById("timing_cursor"),
			srcX: 0, srcY: 0, srcWidth: 24, srcHeight: 48,
			x: timingX, y: 0, width: 18, height: 34
		});
		controls.append(cursor);
		const actionUi = [];
		for (let i = 0; i < 4; ++i) {
			const x = 28 + i * 236;
			// The visual remains 220px wide, while the touch target also covers the
			// 16px gap to the next button. This prevents tiny dead zones on phones.
			const button = new g.E({ scene: scene, x: x, y: 35, width: 236, height: 80, touchable: true });
			const base = new g.FilledRect({ scene: scene, width: 220, height: 78, cssColor: actions[i].color, opacity: 0.78 });
			button.append(base);
			button.append(new g.FilledRect({ scene: scene, width: 10, height: 78, cssColor: "#fff", opacity: 0.9 }));
			button.append(new g.FilledRect({ scene: scene, x: 10, width: 210, height: 3, cssColor: "#fff", opacity: 0.9 }));
			button.append(new g.FilledRect({ scene: scene, x: 10, y: 75, width: 210, height: 3, cssColor: "#fff", opacity: 0.65 }));
			button.append(new g.Sprite({
				scene: scene, src: scene.asset.getImageById(actions[i].icon),
				srcX: 0, srcY: 0, srcWidth: 96, srcHeight: 96,
				x: 16, y: 11, width: 54, height: 54
			}));
			createLabel(scene, button, f30, actions[i].label, 137, 2, "#fff", { anchorX: 0.5 });
			createLabel(scene, button, f16, actions[i].advantage, 78, 43, C.gold, { width: 68, textAlign: g.TextAlign.Center });
			const repeatBadge = new g.Pane({ scene: scene, x: 146, y: 42, width: 70, height: 32, opacity: 0 });
			repeatBadge.append(new g.FilledRect({ scene: scene, width: 70, height: 32, cssColor: "#09050d" }));
			button.append(repeatBadge);
			const repeat = createLabel(scene, repeatBadge, f16, "", 0, 2, C.danger, { width: 70, textAlign: g.TextAlign.Center });
			controls.append(button);
			actionUi.push({ button: button, base: base, repeatBadge: repeatBadge, repeat: repeat });
		}
		const specialButton = new g.E({ scene: scene, x: 28, y: 35, width: 930, height: 78, touchable: true, hidden: true });
		specialButton.append(new g.FilledRect({ scene: scene, width: 930, height: 78, cssColor: C.gold, opacity: 0.94 }));
		specialButton.append(new g.FilledRect({ scene: scene, width: 12, height: 78, cssColor: "#fff" }));
		specialButton.append(new g.FilledRect({ scene: scene, x: 12, width: 918, height: 4, cssColor: "#fff" }));
		createLabel(scene, specialButton, f42, "SPECIAL", 465, 11, "#4a2200", { anchorX: 0.5 });
		controls.append(specialButton);

		// Every SPECIAL owns its cut-in and aura. This prevents a simultaneous
		// activation from replacing another actor's portrait or animation timer.
		const specialFx = new g.E({ scene: scene, width: 1280, height: 570, hidden: true });
		specialFx.append(new g.FilledRect({ scene: scene, width: 1280, height: 570, cssColor: "#09030f", opacity: 0.3 }));
		scene.append(specialFx);
		const specialAuraLayer = new g.E({ scene: scene, width: 1280, height: 570, hidden: true });
		scene.append(specialAuraLayer);
		const specialEffects = [];
		const specialParticlePositions = [
			[10, 34], [38, 12], [176, 14], [202, 48], [6, 132], [204, 146],
			[12, 244], [44, 278], [172, 276], [204, 238], [24, 202], [194, 204]
		];
		const specialMarkData = [[22, 24, 28, 4], [22, 24, 4, 28], [170, 24, 28, 4], [194, 24, 4, 28], [22, 270, 28, 4], [22, 246, 4, 28], [170, 270, 28, 4], [194, 246, 4, 28]];

		const turnFx = new g.E({ scene: scene, width: 1280, height: 720, hidden: true });
		turnFx.append(new g.FilledRect({ scene: scene, x: 340, y: 280, width: 600, height: 116, cssColor: "#13091d", opacity: 0.88 }));
		turnFx.append(new g.FilledRect({ scene: scene, x: 340, y: 280, width: 600, height: 4, cssColor: C.pink }));
		turnFx.append(new g.FilledRect({ scene: scene, x: 340, y: 392, width: 600, height: 4, cssColor: C.cyan }));
		const turnFxLabel = createLabel(scene, turnFx, f52, "TURN 1", 640, 294, "#fff", { anchorX: 0.5 });
		const turnFxSubLabel = createLabel(scene, turnFx, f20, "予選", 640, 354, C.gold, { anchorX: 0.5 });
		scene.append(turnFx);

		// Competition feedback. It only appears when the player's rank or a judge
		// lead changes, keeping the normal playfield quiet while making races clear.
		const competitionFxBaseY = 84;
		const competitionFx = new g.E({ scene: scene, x: 258, y: competitionFxBaseY, width: 492, height: 76, hidden: true });
		const competitionFxBg = new g.FilledRect({ scene: scene, width: 492, height: 76, cssColor: "#13091d", opacity: 0.94 });
		const competitionFxTop = new g.FilledRect({ scene: scene, width: 492, height: 4, cssColor: C.cyan });
		const competitionFxBottom = new g.FilledRect({ scene: scene, y: 72, width: 492, height: 4, cssColor: C.gold });
		competitionFx.append(competitionFxBg);
		competitionFx.append(competitionFxTop);
		competitionFx.append(competitionFxBottom);
		const competitionFxMain = createLabel(scene, competitionFx, f25, "", 246, 6, "#fff", { anchorX: 0.5 });
		const competitionFxSub = createLabel(scene, competitionFx, f20, "", 246, 39, C.gold, { anchorX: 0.5 });
		scene.append(competitionFx);

		// Game state.
		const judges = axes.map(function () {
			const gauge = levelGauge(1);
			return { level: 1, max: gauge, left: gauge, totals: [0, 0, 0, 0, 0, 0], top: -1, closed: false };
		});
		let scores = [0, 0, 0, 0, 0, 0];
		let rankingCache = [0, 1, 2, 3, 4, 5], rankingDirty = true;
		let phase = "title", readyLeft = 3, turn = 0, turnElapsed = 0;
		let trends = makeTrends(), nextTrends = makeTrends(), plans = [];
		let playerActed = true, playerSpecialTurn = false, turnFirst = -1, midpointCommented = false;
		let playerVoltage = 0, playerSpecials = 0, combo = 0;
		let lastPlayerAction = -1, repeatCount = 0, recentActions = [], varietyCooldown = 0;
		let selectedPlayerAction = -1, cursorHoldPosition = 0, cursorLivePosition = 0, lastTurnMiss = false;
		let turnFxLeft = 0, competitionFxLeft = 0, competitionFxDuration = 0, competitionReady = false, scoreSaved = false;
		let aiSpecialCounts = [0, 0, 0, 0, 0, 0];
		let titleLayer = null;
		function setPlayerVoltage(value) {
			const bounded = clamp(value, 0, 100);
			playerVoltage = bounded >= PLAYER_VOLTAGE_READY_THRESHOLD ? 100 : bounded;
			return playerVoltage;
		}
		function addPlayerVoltage(value) { return setPlayerVoltage(playerVoltage + value); }
		function isPlayerVoltageFull() { return playerVoltage >= 100; }
		const scoreTransferStates = [];
		const actionResultStates = [];
		const judgeScoreStates = [];
		const scoreTransferPool = [];
		const actionResultPool = [];
		const judgeScorePool = [];

		function makeTrends() {
			const order = shuffle([0, 1, 2], random), v = [1, 1, 1];
			v[order[0]] = 1.5; v[order[1]] = 1.2; return v;
		}
		function ranking() {
			if (rankingDirty) {
				rankingCache.sort(function (a, b) { return scores[b] - scores[a] || a - b; });
				rankingDirty = false;
			}
			return rankingCache;
		}
		function liveRankingScore() { return Math.max(0, Math.floor(scores[0] * currentStage.scoreMultiplier)); }
		function syncLiveRankingScore() { g.game.vars.gameState.score = liveRankingScore(); }
		function addActorScore(actorIndex, value) {
			scores[actorIndex] += value;
			rankingDirty = true;
			if (actorIndex === 0) syncLiveRankingScore();
		}
		function competitionSnapshot() {
			const rank = ranking();
			const playerRank = rank.indexOf(0) + 1;
			return {
				playerRank: playerRank,
				qualified: playerRank <= currentStage.clearRank,
				judgeTops: judges.map(function (judge) { return judge.top; }),
				playerScore: scores[0]
			};
		}
		function rankGapText(rank) {
			const playerRank = rank.indexOf(0) + 1;
			if (playerRank <= currentStage.clearRank) {
				const below = rank[currentStage.clearRank];
				if (below == null) return "";
				const margin = Math.max(0, Math.floor(scores[0] - scores[below]));
				return currentStage.clearRank === 1 ? "2位差 +" + format(margin) + "pt" : "通過差 +" + format(margin) + "pt";
			}
			const cutoff = rank[currentStage.clearRank - 1];
			const gap = Math.max(1, Math.floor(scores[cutoff] - scores[0]) + 1);
			return currentStage.clearRank === 1 ? "首位まで " + format(gap) + "pt" : "通過まで " + format(gap) + "pt";
		}
		function clearCoefficient(playerRank) {
			if (playerRank <= currentStage.clearRank) return 1;
			if (playerRank === currentStage.clearRank + 1) return 0.45;
			return 0.2;
		}
		function updateLabel(label, text, color) {
			let changed = false;
			if (label.text !== text) { label.text = text; changed = true; }
			if (color != null && label.textColor !== color) { label.textColor = color; changed = true; }
			if (changed) label.invalidate();
		}
		function updateRectWidth(rect, width) {
			if (rect.width === width) return;
			rect.width = width;
			rect.modified();
		}
		function updateOpacity(entity, opacity) {
			if (entity.opacity === opacity) return;
			entity.opacity = opacity;
			entity.modified();
		}
		function updateVisibility(entity, visible) {
			if (entity.visible() === visible) return;
			if (visible) entity.show();
			else entity.hide();
		}
		function showCompetitionNotice(lines, positive, strong, withSound) {
			const accent = positive ? C.cyan : C.danger;
			competitionFxBg.cssColor = positive ? "#10243a" : "#35101d";
			competitionFxTop.cssColor = accent;
			competitionFxBottom.cssColor = strong ? C.gold : accent;
			competitionFxBg.modified(); competitionFxTop.modified(); competitionFxBottom.modified();
			updateLabel(competitionFxMain, lines[0] || "", strong ? C.gold : "#fff");
			updateLabel(competitionFxSub, lines[1] || "", positive ? C.cyan : "#ff9aa2");
			competitionFxDuration = strong ? 1.35 : 0.95;
			competitionFxLeft = competitionFxDuration;
			competitionFx.y = competitionFxBaseY;
			competitionFx.opacity = 1;
			competitionFx.scaleX = strong ? 1.04 : 1;
			competitionFx.scaleY = strong ? 1.04 : 1;
			competitionFx.show();
			competitionFx.modified();
			if (withSound) playSe(positive ? "se_timing_good" : "se_timing_bad", positive ? 0.32 : 0.28);
		}
		function showCompetitionChanges(before, sourceActor, timingName) {
			const after = competitionSnapshot();
			const rankUp = after.playerRank < before.playerRank;
			const rankDown = after.playerRank > before.playerRank;
			const crossedIn = !before.qualified && after.qualified;
			const crossedOut = before.qualified && !after.qualified;
			const gained = [], lost = [];
			for (let i = 0; i < judges.length; ++i) {
				if (before.judgeTops[i] !== 0 && after.judgeTops[i] === 0) gained.push(axes[i].trend);
				if (before.judgeTops[i] === 0 && after.judgeTops[i] !== 0) lost.push(axes[i].trend);
			}
			if (!rankUp && !rankDown && !crossedIn && !crossedOut && gained.length === 0 && lost.length === 0) return;

			const scoreGain = Math.max(0, Math.floor(after.playerScore - before.playerScore));
			const bigSuccess = sourceActor === 0 && timingName === "PERFECT" && rankUp && gained.length > 0;
			const lines = [];
			if (bigSuccess) {
				lines.push(crossedIn ? (currentStage.clearRank === 1 ? "優勝圏内に浮上！" : "通過圏内に浮上！") : "▲ " + before.playerRank + "位 → " + after.playerRank + "位！");
				lines.push(gained.join("・") + " TOP奪取  +" + format(scoreGain) + "pt");
				showCompetitionNotice(lines, true, true, false);
				return;
			}

			if (crossedIn) lines.push(currentStage.clearRank === 1 ? "優勝圏内に浮上！" : "通過圏内に浮上！");
			else if (crossedOut) lines.push(currentStage.clearRank === 1 ? "優勝圏外へ転落！" : "通過圏外へ転落！");
			else if (rankUp) lines.push("▲ " + before.playerRank + "位 → " + after.playerRank + "位！");
			else if (rankDown) lines.push("▼ " + before.playerRank + "位 → " + after.playerRank + "位");
			else if (gained.length > 0) lines.push(gained.join("・") + " TOP奪取！");
			else lines.push(lost.join("・") + " TOPを奪われた！");

			if ((crossedIn || crossedOut) && (rankUp || rankDown)) lines.push((rankUp ? "▲ " : "▼ ") + before.playerRank + "位 → " + after.playerRank + "位");
			else if (gained.length > 0 && lines[0].indexOf("TOP奪取") < 0) lines.push(gained.join("・") + " TOP奪取！");
			else if (lost.length > 0 && lines[0].indexOf("奪われた") < 0) lines.push(lost.join("・") + " TOPを奪われた！");

			if (lines.length < 2) {
				if (rankDown && sourceActor > 0) lines.push("No." + actors[sourceActor].no + "に抜かれた！");
				else if (sourceActor === 0 && scoreGain > 0) lines.push("+" + format(scoreGain) + "pt");
				else lines.push(rankGapText(ranking()));
			}
			showCompetitionNotice(lines, rankUp || crossedIn || gained.length > 0, crossedIn || crossedOut, sourceActor > 0 && rankDown);
		}
		function setStageAppearance() {
			const background = scene.asset.getImageById(currentStage.background);
			if (stageBackground.src !== background) { stageBackground.src = background; stageBackground.modified(); }
			updateLabel(stagePhaseLabel, currentStage.name, "#fff");
		}
		function showTurnStart() {
			turnFxLabel.text = "TURN " + turn;
			turnFxLabel.invalidate();
			turnFxSubLabel.text = lastTurnMiss ? "前ターン MISS / " + currentStage.name : currentStage.name;
			turnFxSubLabel.textColor = lastTurnMiss ? C.danger : "#fff";
			turnFxSubLabel.invalidate();
			turnFx.opacity = 1;
			turnFx.show();
			turnFx.modified();
			turnFxLeft = 0.72;
		}

		function updateTrendUi() {
			const order = [0, 1, 2].sort(function (a, b) { return trends[b] - trends[a]; });
			for (let i = 0; i < 3; ++i) {
				const axis = order[i]; trendLabels[i].text = (i + 1) + " " + axes[axis].trend + " " + Math.round(trends[axis] * 100) + "%";
				trendLabels[i].textColor = axes[axis].color; trendLabels[i].invalidate();
			}
		}

		function updateTimingZones() {
			const c = timingConfig();
			const bounds = [0, 0.5 - c.normal, 0.5 - c.good, 0.5 - c.perfect, 0.5 + c.perfect, 0.5 + c.good, 0.5 + c.normal, 1];
			for (let i = 0; i < timingZones.length; ++i) {
				const left = timingX + Math.round(bounds[i] * timingW);
				const right = timingX + Math.round(bounds[i + 1] * timingW);
				timingZones[i].rect.x = left; timingZones[i].rect.scaleX = Math.max(1, right - left) / 128; timingZones[i].rect.modified();
				timingZones[i].label.x = left + Math.round((right - left) / 2); timingZones[i].label.modified();
			}
		}

		function setActorState(actorIndex, acted) {
			const ui = actorUi[actorIndex];
			ui.acted = acted;
			ui.sprite.opacity = acted ? 0.5 : 1;
			ui.sprite.modified();
		}

		function chooseAiAction(actorIndex) {
			const a = actors[actorIndex];
			const effectiveAdapt = clamp(a.adapt * currentStage.aiAdapt, 0, 0.96);
			if (random.generate() > effectiveAdapt) return random.generate() < 0.72 ? a.favorite : Math.floor(random.generate() * 4);
			let best = 0, bestV = -1;
			for (let action = 0; action < 4; ++action) {
				let v = action === a.favorite ? 45 : 0;
				for (let axis = 0; axis < 3; ++axis) v += actions[action].base[axis] * trends[axis] * a.stats[axis];
				if (v > bestV) { best = action; bestV = v; }
			}
			return best;
		}

		function chooseAiTime(actorIndex) {
			const style = actors[actorIndex].timing;
			if (style === "early") return 0.55 + random.generate() * 0.85;
			if (style === "late") return 3.4 + random.generate() * 1.15;
			if (style === "sniper") {
				const period = timingConfig().period, perfects = [];
				for (let t = period * 0.25; t < TURN_SECONDS - 0.15; t += period * 0.5) perfects.push(t);
				return perfects[Math.floor(random.generate() * perfects.length)] + (random.generate() - 0.5) * 0.08 * currentStage.aiTimingError;
			}
			if (style === "rival") {
				const period = timingConfig().period, goodWindows = [];
				for (let t = period * 0.25; t < TURN_SECONDS - 0.15; t += period * 0.5) goodWindows.push(t);
				return goodWindows[Math.floor(random.generate() * goodWindows.length)] + (random.generate() - 0.5) * 0.28 * currentStage.aiTimingError;
			}
			if (style === "middle") return 1.2 + random.generate() * 2.05;
			return 0.9 + random.generate() * 3.45;
		}

		function preparePlans() {
			plans = [];
			for (let actor = 1; actor < 6; ++actor) {
				const a = actors[actor];
				const specialIndex = aiSpecialCounts[actor];
				const specialTurns = currentStage.aiSpecialTurns[actor] || [];
				const unlockTurn = specialTurns[specialIndex] == null ? TOTAL_TURNS + 1 : specialTurns[specialIndex];
				const special = !!a.special && a.voltage >= 100 && specialIndex < currentStage.aiSpecialMax[actor] && turn >= unlockTurn;
				const time = chooseAiTime(actor), action = chooseAiAction(actor);
				plans.push({ actor: actor, action: action, time: time, acted: false, special: special, timing: judgeTiming(timingPositionAt(time)) });
			}
			let specialKept = false;
			for (let i = plans.length - 1; i >= 0; --i) {
				if (!plans[i].special) continue;
				if (specialKept) plans[i].special = false;
				else specialKept = true;
			}
		}

		function setJudgeComment(index, text, color) {
			judgeUi[index].comment.text = text; judgeUi[index].comment.textColor = color || C.muted; judgeUi[index].comment.invalidate();
		}
		function judgeLeadLine(index, actorNo) {
			return ["No." + actorNo + "、姿勢が綺麗", "No." + actorNo + "、いい歩き！", "No." + actorNo + "、笑顔が最高"][index];
		}
		function judgeNearLine(index) {
			return ["最後に決め姿を", "ラストの一歩よ！", "最高の笑顔をお願い"][index];
		}
		function judgeCloseLine(index, firstNo, secondNo) {
			return ["No." + firstNo + "と" + secondNo + "、甲乙なし", "No." + firstNo + "と" + secondNo + "、接戦！", "No." + firstNo + "と" + secondNo + "、迷うわ"][index];
		}
		function judgeFinishLine(index, actorNo) {
			return ["No." + actorNo + "、決め姿！", "No." + actorNo + "、見事な一歩！", "No." + actorNo + "、最高の笑顔！"][index];
		}

		function rotateClosedJudges() {
			let added = false;
			for (let i = 0; i < 3; ++i) {
				const j = judges[i], ui = judgeUi[i];
				if (!j.closed) continue;
				added = true;
				j.level += 1; j.max = levelGauge(j.level); j.left = j.max; j.totals = [0, 0, 0, 0, 0, 0]; j.top = -1; j.closed = false;
				ui.panel.y = -128; ui.panel.opacity = 0; ui.enter = 0.5; ui.depart = 0;
				ui.panel.modified();
				setJudgeComment(i, ["次は立ち姿を見せて", "さあ、歩きを見せて！", "次は表情で魅せて"][i], axes[i].color);
			}
			if (added) playSe("se_judge_add", 0.68);
		}

		function startTurn() {
			++turn; turnElapsed = 0; playerActed = false; turnFirst = -1; midpointCommented = false;
			selectedPlayerAction = -1; cursorHoldPosition = 0; cursorLivePosition = 0;
			rotateClosedJudges(); trends = nextTrends; nextTrends = makeTrends();
			setStageAppearance();
			showTurnStart();
			playSe("se_turn_start", 0.58);
			lastTurnMiss = false;
			timingDifficulty = Math.min(6, Math.floor(combo / 3)); updateTimingZones();
			const voltageWasFull = isPlayerVoltageFull();
			setPlayerVoltage(playerVoltage);
			if (playerSpecials === 0 && turn >= 13) setPlayerVoltage(100);
			if (!voltageWasFull && isPlayerVoltageFull()) playSe("se_voltage_max", 0.76);
			playerSpecialTurn = isPlayerVoltageFull();
			for (let i = 0; i < 6; ++i) {
				setActorState(i, false);
				setActorMotion(i, "idle", false);
			}
			preparePlans(); updateTrendUi();
			judgmentLabel.text = playerSpecialTurn ? "▲タイミングよくSPECIALを選択" : "▲タイミングよくいずれかのアクションを選択";
			judgmentLabel.textColor = C.gold;
			judgmentLabel.invalidate();
		}

		function syncPlayerSpecialAvailability() {
			setPlayerVoltage(playerVoltage);
			if (phase !== "play" || playerActed || playerSpecialTurn || !isPlayerVoltageFull()) return;
			playerSpecialTurn = true;
			judgmentLabel.text = "▲タイミングよくSPECIALを選択";
			judgmentLabel.invalidate();
		}

		function startSelectedStage(stageIndex) {
			if (phase !== "title") return;
			selectedStageIndex = clamp(stageIndex, 0, STAGE_CONFIGS.length - 1);
			currentStage = STAGE_CONFIGS[selectedStageIndex];
			storedData.selected = selectedStageIndex;
			writeStoredData();
			stopOpeningBgm();
			if (titleLayer) titleLayer.hide();

			scores = [0, 0, 0, 0, 0, 0]; rankingCache = [0, 1, 2, 3, 4, 5]; rankingDirty = true;
			turn = 0; turnElapsed = 0; readyLeft = 3;
			trends = makeTrends(); nextTrends = makeTrends(); plans = [];
			playerActed = true; playerSpecialTurn = false; turnFirst = -1; midpointCommented = false;
			setPlayerVoltage(0); playerSpecials = 0; combo = 0; timingDifficulty = 0;
			lastPlayerAction = -1; repeatCount = 0; recentActions = []; varietyCooldown = 0;
			selectedPlayerAction = -1; cursorHoldPosition = 0; cursorLivePosition = 0; lastTurnMiss = false;
			turnFxLeft = 0; competitionReady = false; scoreSaved = false; aiSpecialCounts = [0, 0, 0, 0, 0, 0];
			g.game.vars.gameState.score = 0;

			for (let i = 0; i < judges.length; ++i) {
				const gauge = levelGauge(1);
				judges[i].level = 1; judges[i].max = gauge; judges[i].left = gauge;
				judges[i].totals = [0, 0, 0, 0, 0, 0]; judges[i].top = -1; judges[i].closed = false;
				judgeUi[i].panel.y = 14; judgeUi[i].panel.opacity = 1;
				judgeUi[i].depart = 0; judgeUi[i].enter = 0; judgeUi[i].panel.modified();
			}
			for (let i = 1; i < actors.length; ++i) actors[i].voltage = currentStage.aiVoltage[i];
			for (let i = 0; i < actors.length; ++i) {
				setActorState(i, false);
				setActorMotion(i, "idle", false);
			}
			turnFx.hide();
			competitionFxLeft = 0; competitionFx.hide();
			phase = "ready";
			setStageAppearance(); updateTrendUi(); updateTimingZones(); refreshHud();
		}

		function awardFirst(actorIndex) {
			if (turnFirst >= 0) return;
			turnFirst = actorIndex; addActorScore(actorIndex, 350);
			if (actorIndex === 0) addPlayerVoltage(7);
		}

		function closeJudge(index, lastActor) {
			const j = judges[index], order = [0, 1, 2, 3, 4, 5].sort(function (a, b) { return j.totals[b] - j.totals[a] || a - b; });
			const topActor = order[0];
			addActorScore(topActor, 1000); addActorScore(lastActor, 500);
			j.left = 0; j.top = topActor; j.closed = true;
			setJudgeComment(index, judgeFinishLine(index, actors[lastActor].no), C.gold);
			judgeUi[index].depart = 0.5;
			if (topActor === 0) addPlayerVoltage(12);
			if (lastActor === 0) addPlayerVoltage(9);
		}

		function playScoreTransfer(judgeIndex, actorIndex, value) {
			const startX = 12 + judgeIndex * 244 + 118;
			const startY = 132;
			const endX = 12 + actorX[actorIndex] + 50;
			const endY = 356;
			let fx = scoreTransferPool.pop();
			if (!fx) {
				const entity = new g.E({ scene: scene, width: 96, height: 30 });
				const marker = new g.FilledRect({ scene: scene, x: 2, y: 7, width: 16, height: 16, cssColor: axes[judgeIndex].color, angle: 45, opacity: 0.95 });
				entity.append(marker);
				entity.append(new g.FilledRect({ scene: scene, x: 5, y: 10, width: 10, height: 10, cssColor: "#fff", angle: 45, opacity: 0.9 }));
				const label = createLabel(scene, entity, f16, "", 24, 2, axes[judgeIndex].color);
				scene.append(entity);
				fx = { entity: entity, marker: marker, label: label };
			}
			fx.entity.x = startX - 48; fx.entity.y = startY; fx.entity.opacity = 1; if (!fx.entity.visible()) fx.entity.show(); fx.entity.modified();
			if (fx.marker.cssColor !== axes[judgeIndex].color) { fx.marker.cssColor = axes[judgeIndex].color; fx.marker.modified(); }
			updateLabel(fx.label, "+" + value, axes[judgeIndex].color);
			fx.left = 0.72; fx.startX = startX - 48; fx.startY = startY; fx.endX = endX - 48; fx.endY = endY;
			scoreTransferStates.push(fx);
		}

		function applyActorAppeal(actorIndex, actionIndex, timing, special, powerMod) {
			awardFirst(actorIndex);
			const a = actors[actorIndex], action = actions[actionIndex];
			const specialMulti = { BAD: 0.75, NORMAL: 1, GOOD: 1.5, PERFECT: 2 }[timing.name];
			const appeals = [0, 0, 0];
			let judgeLeft = false;
			for (let axis = 0; axis < 3; ++axis) {
				const j = judges[axis];
				if (j.closed) continue;
				const base = special ? 620 : action.base[axis];
				const value = Math.round(base * (special ? specialMulti : timing.multi) * trends[axis] * a.stats[axis] * powerMod);
				appeals[axis] = value;
				playScoreTransfer(axis, actorIndex, value);
				const oldTop = j.top;
				j.left -= value; j.totals[actorIndex] += value; addActorScore(actorIndex, value * levelMulti(j.level));
				j.top = j.totals.indexOf(Math.max.apply(null, j.totals));
				if (j.left <= 0) { closeJudge(axis, actorIndex); judgeLeft = true; }
				else if (j.top !== oldTop) setJudgeComment(axis, judgeLeadLine(axis, actors[j.top].no), axes[axis].color);
				else if (j.left / j.max < 0.2) setJudgeComment(axis, judgeNearLine(axis), C.gold);
			}
			if (judgeLeft) playSe("se_judge_leave", 0.7);
			return appeals;
		}

		function showActionResult(actorIndex, timingName) {
			const assetId = ACTION_RESULT_ASSET_IDS[timingName];
			if (!assetId) return;
			const width = 150, height = 40;
			const startX = 12 + actorX[actorIndex] + 50 - width / 2;
			const startY = 210;
			let fx = actionResultPool.pop();
			if (!fx) {
				const sprite = new g.Sprite({
					scene: scene, src: scene.asset.getImageById(assetId),
					srcX: 0, srcY: 0, srcWidth: 240, srcHeight: 64,
					width: width, height: height
				});
				scene.append(sprite);
				fx = { entity: sprite };
			}
			const resultImage = scene.asset.getImageById(assetId);
			if (fx.entity.src !== resultImage) { fx.entity.src = resultImage; fx.entity.invalidate(); }
			fx.entity.x = startX; fx.entity.y = startY; fx.entity.opacity = 1; if (!fx.entity.visible()) fx.entity.show(); fx.entity.modified();
			fx.left = 0.95; fx.duration = 0.95; fx.startY = startY;
			actionResultStates.push(fx);
		}
		function showJudgeAppealFeedback(appeals) {
			for (let i = 0; i < 3; ++i) {
				if (appeals[i] <= 0) continue;
				const startY = 40;
				let fx = judgeScorePool.pop();
				if (!fx) fx = { entity: createLabel(scene, scene, f30, "", 0, startY, axes[i].color, { anchorX: 0.5 }) };
				fx.entity.x = 12 + i * 244 + 118; fx.entity.y = startY; fx.entity.opacity = 1; if (!fx.entity.visible()) fx.entity.show(); fx.entity.modified();
				updateLabel(fx.entity, "+" + appeals[i], axes[i].color);
				fx.left = 1.0; fx.duration = 1.0; fx.startY = startY;
				judgeScoreStates.push(fx);
			}
		}
		function showPlayerAppealFeedback(appeals) {
			showJudgeAppealFeedback(appeals);
		}

		function showSpecial(actorIndex) {
			const portraitId = SPECIAL_PORTRAIT_ASSET_IDS[actorIndex];
			if (!portraitId) return;
			const isPlayerSpecial = actorIndex === 0;
			playSe(isPlayerSpecial ? "se_special_player" : "se_special_opponent", isPlayerSpecial ? 0.82 : 0.76);
			const actorCenterX = 12 + actorX[actorIndex] + 50;
			let opponentSlot = 0;
			if (!isPlayerSpecial) {
				for (let i = 0; i < specialEffects.length; ++i) if (!specialEffects[i].isPlayer) ++opponentSlot;
				opponentSlot = Math.min(1, opponentSlot);
			}
			const targetX = isPlayerSpecial ? 800 : (opponentSlot === 0 ? 34 : 390);
			const startX = isPlayerSpecial ? 1290 : -440;
			const exitX = isPlayerSpecial ? 1340 : -490;
			const baseY = isPlayerSpecial ? 66 : 96;
			const cutinScale = isPlayerSpecial ? 0.88 : 0.82;

			const panel = new g.E({
				scene: scene, x: startX, y: baseY, width: 420, height: 540,
				scaleX: cutinScale, scaleY: cutinScale, angle: isPlayerSpecial ? 0 : (opponentSlot === 0 ? -2 : 2)
			});
			panel.append(new g.FilledRect({ scene: scene, x: -10, y: -10, width: 440, height: 560, cssColor: isPlayerSpecial ? C.pink : "#ff303f", opacity: 0.24 }));
			panel.append(new g.FilledRect({ scene: scene, width: 420, height: 540, cssColor: isPlayerSpecial ? "#15091d" : "#21080d", opacity: 0.96 }));
			panel.append(new g.FilledRect({ scene: scene, x: 0, y: 0, width: 14, height: 540, cssColor: isPlayerSpecial ? C.pink : "#ff394e" }));
			panel.append(new g.FilledRect({ scene: scene, x: 14, y: 0, width: 406, height: 5, cssColor: isPlayerSpecial ? C.gold : "#ff5969" }));
			panel.append(new g.FilledRect({ scene: scene, x: 14, y: 535, width: 406, height: 5, cssColor: isPlayerSpecial ? C.cyan : C.gold }));
			panel.append(new g.Sprite({
				scene: scene, src: scene.asset.getImageById(portraitId),
				srcX: 0, srcY: 0, srcWidth: 368, srcHeight: 460,
				x: 18, y: 20, width: 384, height: 480
			}));
			if (!isPlayerSpecial) panel.append(new g.FilledRect({ scene: scene, x: 14, y: 0, width: 406, height: 52, cssColor: "#8f1624", opacity: 0.72 }));
			panel.append(new g.FilledRect({ scene: scene, x: 14, y: 476, width: 406, height: 64, cssColor: "#09030f", opacity: 0.9 }));
			createLabel(scene, panel, f30, isPlayerSpecial ? "YOU / SPECIAL!" : "No." + actors[actorIndex].no + " / ENEMY SPECIAL!", 217, 484, isPlayerSpecial ? "#fff" : "#ffe1d8", { anchorX: 0.5 });
			createLabel(scene, panel, f16, isPlayerSpecial ? "PLAYER SPECIAL CUT-IN" : "!! OPPONENT SPECIAL !!", 402, 9, isPlayerSpecial ? C.gold : "#fff", { anchorX: 1 });
			specialFx.append(panel);

			const aura = new g.E({ scene: scene, x: actorCenterX - 110, y: 214, width: 220, height: 300, scaleX: 0.9, scaleY: 0.9 });
			const particles = [];
			for (let i = 0; i < specialParticlePositions.length; ++i) {
				const p = specialParticlePositions[i];
				const particle = new g.FilledRect({
					scene: scene, x: p[0], y: p[1], width: i % 3 === 0 ? 12 : 8, height: i % 3 === 0 ? 12 : 8,
					cssColor: i % 3 === 0 ? C.gold : (i % 3 === 1 ? "#fff" : C.cyan), angle: 45
				});
				aura.append(particle);
				particles.push(particle);
			}
			for (let i = 0; i < specialMarkData.length; ++i) {
				const d = specialMarkData[i];
				aura.append(new g.FilledRect({ scene: scene, x: d[0], y: d[1], width: d[2], height: d[3], cssColor: actors[actorIndex].color }));
			}
			specialAuraLayer.append(aura);
			specialEffects.push({
				actorIndex: actorIndex, isPlayer: isPlayerSpecial, panel: panel, aura: aura, particles: particles,
				left: 1.65, startX: startX, targetX: targetX, exitX: exitX, baseY: baseY, particleStep: -1
			});
			specialFx.show();
			specialAuraLayer.show();
		}

		function resolveAi(plan) {
			if (plan.acted) return;
			plan.acted = true;
			const competitionBefore = competitionSnapshot();
			const playerVoltageWasFull = isPlayerVoltageFull();
			applyActorAppeal(plan.actor, plan.action, plan.timing, plan.special, currentStage.aiPower);
			if (competitionReady) showCompetitionChanges(competitionBefore, plan.actor, plan.timing.name);
			syncPlayerSpecialAvailability();
			if (!playerVoltageWasFull && isPlayerVoltageFull()) playSe("se_voltage_max", 0.76);
			const a = actors[plan.actor];
			if (plan.special) { a.voltage = 0; ++aiSpecialCounts[plan.actor]; showSpecial(plan.actor); }
			else {
				const gain = plan.timing.voltage * (plan.action === 3 ? 1.3 : 1) * (a.special ? 1.25 : 1) * currentStage.aiVoltageGain;
				a.voltage = clamp(a.voltage + gain, 0, 100);
			}
			setActorState(plan.actor, true);
			playActorAnimation(plan.actor, plan.action, plan.special);
			showActionResult(plan.actor, plan.timing.name);
		}

		function resolvePlayer(actionIndex) {
			if (phase !== "play" || playerActed) return;
			const competitionBefore = competitionSnapshot();
			// Judge the position represented by the cursor entity. This avoids a
			// one-update discrepancy between the last visible frame and point input.
			cursorHoldPosition = cursorLivePosition;
			playerActed = true;
			selectedPlayerAction = actionIndex;
			const voltageBeforeAction = playerVoltage;
			const playerVoltageWasFull = isPlayerVoltageFull();
			const timing = judgeTiming(cursorHoldPosition);
			const special = playerSpecialTurn;
			if (!special) {
				const timingSeVolume = { PERFECT: 0.68, GOOD: 0.62, NORMAL: 0.58, BAD: 0.62 }[timing.name];
				playSe(TIMING_SE_ASSET_IDS[timing.name], timingSeVolume);
			}
			let repeatMod = 1, variety = false;
			if (!special) {
				if (lastPlayerAction === actionIndex) ++repeatCount; else repeatCount = 1;
				lastPlayerAction = actionIndex;
				repeatMod *= repeatCount === 2 ? 0.85 : (repeatCount >= 3 ? 0.7 : 1);
				recentActions.push(actionIndex); if (recentActions.length > 4) recentActions.shift();
				if (varietyCooldown > 0) --varietyCooldown;
				const unique = {};
				for (let i = 0; i < recentActions.length; ++i) unique[recentActions[i]] = true;
				variety = Object.keys(unique).length >= 3 && varietyCooldown === 0;
				if (variety) { varietyCooldown = 2; addPlayerVoltage(10); }
			}
			const comboMod = 1 + Math.min(0.25, Math.floor(combo / 5) * 0.05);
			const appeals = applyActorAppeal(0, actionIndex, timing, special, repeatMod * (variety ? 1.15 : 1) * comboMod);
			competitionReady = true;
			showCompetitionChanges(competitionBefore, 0, timing.name);
			if (timing.name === "GOOD" || timing.name === "PERFECT") ++combo; else combo = 0;
			if (special) { setPlayerVoltage(0); ++playerSpecials; showSpecial(0); }
			else addPlayerVoltage(timing.voltage * (actionIndex === 3 ? 1.3 : 1));
			if (!special && timing.name === "BAD") setPlayerVoltage(voltageBeforeAction);
			if (!special && !playerVoltageWasFull && isPlayerVoltageFull()) playSe("se_voltage_max", 0.76);
			showPlayerAppealFeedback(appeals);
			setActorState(0, true);
			playActorAnimation(0, actionIndex, special);
			showActionResult(0, timing.name);
		}

		function resolveMiss() {
			if (phase !== "play" || playerActed) return;
			cursorHoldPosition = timingPositionAt(TURN_SECONDS);
			playerActed = true;
			selectedPlayerAction = -1;
			combo = 0;
			lastTurnMiss = true;
			competitionReady = true;
			playSe("se_miss", 0.7);
			setActorState(0, true);
			setActorMotion(0, "idle", false);
			showActionResult(0, "MISS");
		}

		function midpointComments() {
			for (let i = 0; i < 3; ++i) {
				const j = judges[i];
				if (j.closed) continue;
				if (j.top < 0) setJudgeComment(i, ["姿勢を見せて", "一歩目を見せて", "笑ってみせて"][i], C.muted);
				else {
					const order = [0, 1, 2, 3, 4, 5].sort(function (a, b) { return j.totals[b] - j.totals[a] || a - b; });
					const close = j.totals[order[1]] > 0 && j.totals[order[1]] >= j.totals[order[0]] * 0.85;
					setJudgeComment(i, close ? judgeCloseLine(i, actors[order[0]].no, actors[order[1]].no) : judgeLeadLine(i, actors[order[0]].no), axes[i].color);
				}
			}
		}

		function refreshHud() {
			syncPlayerSpecialAvailability();
			const elapsed = Math.max(0, (turn - 1) * TURN_SECONDS + turnElapsed), left = Math.max(0, TURN_SECONDS * TOTAL_TURNS - elapsed), rank = ranking();
			const playerRank = rank.indexOf(0) + 1;
			const qualified = playerRank <= currentStage.clearRank;
			const sec = Math.ceil(left);
			updateLabel(timeLabel, pad2(Math.floor(sec / 60)) + ":" + pad2(sec % 60));
			updateLabel(turnLabel, "TURN " + turn + " / " + TOTAL_TURNS);
			updateLabel(scoreLabel, format(scores[0]) + " pt");
			updateLabel(voltageText, Math.round(playerVoltage) + "%");
			updateRectWidth(voltageBar.fill, Math.max(0, Math.round(voltageBar.max * playerVoltage / 100)));
			updateLabel(comboLabel, String(combo));
			updateLabel(comboGaugeEffect, "速度↑ 幅↓ Lv" + timingDifficulty);
			updateLabel(comboScoreEffect, "アピール x" + (1 + Math.min(0.25, Math.floor(combo / 5) * 0.05)).toFixed(2));
			let countdownText;
			if (phase === "ready") countdownText = "開始まで " + Math.max(1, Math.ceil(readyLeft)) + "秒";
			else {
				const countdown = Math.max(0, TURN_SECONDS - turnElapsed).toFixed(1);
				countdownText = turn >= TOTAL_TURNS ? "終了まで " + countdown + "秒" : "次ターンまで " + countdown + "秒";
			}
			updateLabel(nextTurnLabel, countdownText);
			const passText = playerRank + "位" + (currentStage.clearRank === 1 ? (qualified ? "優勝" : "圏外") : (qualified ? "圏内" : "圏外"));
			updateLabel(passBadgeLabel, passText, "#fff");
			const passColor = qualified ? C.green : C.danger;
			if (passBadgeBg.cssColor !== passColor) { passBadgeBg.cssColor = passColor; passBadgeBg.modified(); }
			const lineY = 470 + currentStage.clearRank * 30;
			if (qualificationLine.y !== lineY) { qualificationLine.y = lineY; qualificationLine.modified(); }
			updateLabel(rankGapLabel, rankGapText(rank), qualified ? C.gold : C.danger);
			for (let i = 0; i < 6; ++i) {
				updateLabel(miniLabels[i], "No." + actors[rank[i]].no + "  " + format(scores[rank[i]]), rank[i] === 0 ? C.pink : C.muted);
			}
			for (let i = 0; i < 6; ++i) {
				const actorRank = rank.indexOf(i) + 1, ui = actorUi[i];
				const rankImage = scene.asset.getImageById(RANK_ASSET_IDS[actorRank - 1]);
				if (ui.rankSprite.src !== rankImage) { ui.rankSprite.src = rankImage; ui.rankSprite.invalidate(); }
			}
			for (let i = 0; i < 3; ++i) {
				const j = judges[i], ui = judgeUi[i];
				updateLabel(ui.lv, "Lv" + j.level);
				updateRectWidth(ui.gauge.fill, j.closed ? 0 : Math.max(0, Math.round(ui.gauge.max * j.left / j.max)));
			}
			cursorLivePosition = playerActed ? cursorHoldPosition : timingPositionAt(turnElapsed);
			const cursorX = timingX + Math.round(cursorLivePosition * (timingW - cursor.width));
			if (cursor.x !== cursorX) { cursor.x = cursorX; cursor.modified(); }
			for (let i = 0; i < 4; ++i) {
				updateVisibility(actionUi[i].button, !playerSpecialTurn);
				const selected = playerActed && selectedPlayerAction === i;
				const available = phase === "play" && !playerActed;
				updateOpacity(actionUi[i].base, selected ? 1 : (available ? 0.94 : (playerActed ? 0.16 : 0.5)));
				const nextRepeat = lastPlayerAction === i ? (repeatCount >= 2 ? " -30%" : " -15%") : "";
				updateLabel(actionUi[i].repeat, selected ? "" : nextRepeat.trim());
				updateOpacity(actionUi[i].repeatBadge, !selected && nextRepeat ? 0.82 : 0);
			}
			updateVisibility(specialButton, playerSpecialTurn);
			updateOpacity(specialButton, phase === "play" && !playerActed ? 1 : 0.36);
		}

		function updateJudgeMotion(dt) {
			for (let i = 0; i < 3; ++i) {
				const ui = judgeUi[i];
				if (ui.depart > 0) {
					ui.depart -= dt; const p = clamp((0.5 - ui.depart) / 0.5, 0, 1);
					ui.panel.y = 14 - 142 * p; ui.panel.opacity = 1 - p;
					if (ui.depart <= 0) { ui.panel.y = -128; ui.panel.opacity = 0; }
					ui.panel.modified();
				} else if (ui.enter > 0) {
					ui.enter -= dt; const p = clamp((0.5 - ui.enter) / 0.5, 0, 1);
					ui.panel.y = -128 + 142 * p; ui.panel.opacity = p;
					if (ui.enter <= 0) { ui.panel.y = 14; ui.panel.opacity = 1; }
					ui.panel.modified();
				}
			}
		}

		function getResultDialogue(stageIndex, playerRank, qualified) {
			if (stageIndex === 0) {
				if (qualified && playerRank === 1) return ["やった！ 予選トップ通過だ！", "この勢いで次も魅せてやるよ！"];
				if (qualified) return ["予選突破だ！", "まだ伸びしろはある。次はもっと上を狙うよ！"];
				return ["くやしい……予選敗退か。", "次は絶対、もっと良い私を見せるよ。"];
			}
			if (stageIndex === 1) {
				if (qualified && playerRank === 1) return ["準決勝も1位通過！", "決勝でも最高のステージを見せよう！"];
				if (qualified) return ["2位で決勝進出だ！", "ここからが本番。最後は勝ちにいくよ！"];
				return ["あと一歩だった……。", "この悔しさ、次のステージで晴らすよ。"];
			}
			if (qualified) return ["やった！ 私がチャンピオンだ！", "最高のコーチング、ありがとな！"];
			return ["くやしい……でも、まだ終わりじゃない。", "次こそ一番輝いてみせるよ！"];
		}

		function showResult() {
			phase = "end";
			if (bgmPlayer) { bgmPlayer.stop(); bgmPlayer = null; }
			const rank = ranking();
			const playerRank = rank.indexOf(0) + 1;
			const qualified = playerRank <= currentStage.clearRank;
			const coefficient = clearCoefficient(playerRank);
			const registeredScore = Math.max(0, Math.floor(scores[0] * currentStage.scoreMultiplier * coefficient));
			g.game.vars.gameState.score = registeredScore;
			const resultMe = scene.asset.getAudioById(qualified ? "me_victory" : "me_defeat").play();
			if (resultMe && resultMe.changeVolume) resultMe.changeVolume(0.48);

			const resultLayer = new g.E({ scene: scene, width: 1280, height: 720 });
			resultLayer.append(new g.Sprite({ scene: scene, src: scene.asset.getImageById("title_backdrop"), width: 1280, height: 720 }));
			resultLayer.append(new g.FilledRect({ scene: scene, width: 1280, height: 720, cssColor: "#090412", opacity: 0.58 }));
			scene.append(resultLayer);

			const p = createPanel(scene, resultLayer, 46, 42, 578, 636, "#130a20", C.pink, 0.94);
			p.append(new g.FilledRect({ scene: scene, x: 10, y: 10, width: 558, height: 68, cssColor: "#321244", opacity: 0.92 }));
			createLabel(scene, p, f42, "RESULT", 289, 14, "#fff", { anchorX: 0.5 });
			createLabel(scene, p, f25, currentStage.name + "  /  " + (qualified ? "STAGE CLEAR" : "STAGE FAILED"), 289, 80, qualified ? C.gold : C.danger, { anchorX: 0.5 });

			for (let i = 0; i < 6; ++i) {
				const actor = rank[i], isPlayer = actor === 0, color = isPlayer ? "#fff" : C.muted, y = 132 + i * 58;
				if (isPlayer) {
					p.append(new g.FilledRect({ scene: scene, x: 18, y: y - 8, width: 542, height: 52, cssColor: "#6c1c55", opacity: 0.78 }));
					p.append(new g.FilledRect({ scene: scene, x: 18, y: y - 8, width: 5, height: 52, cssColor: C.gold }));
				}
				p.append(new g.Sprite({ scene: scene, src: scene.asset.getImageById(RANK_ASSET_IDS[i]), srcX: 0, srcY: 0, srcWidth: 80, srcHeight: 80, x: 28, y: y - 8, width: 48, height: 48 }));
				createLabel(scene, p, f25, "No." + actors[actor].no + "  " + actors[actor].name, 88, y, color);
				createLabel(scene, p, f25, format(scores[actor]) + " pt", 542, y, isPlayer ? C.gold : color, { anchorX: 1 });
			}
			p.append(new g.FilledRect({ scene: scene, x: 18, y: 500, width: 542, height: 114, cssColor: "#261133", opacity: 0.92 }));
			createLabel(scene, p, f25, "YOUR SCORE", 289, 510, "#fff", { anchorX: 0.5 });
			createLabel(scene, p, f42, format(registeredScore) + " pt", 289, 548, C.gold, { anchorX: 0.5 });

			const dialogue = getResultDialogue(selectedStageIndex, playerRank, qualified);
			resultLayer.append(new g.Sprite({ scene: scene, src: scene.asset.getImageById("speech_bubble"), x: 638, y: 36, width: 610, height: 183 }));
			createLabel(scene, resultLayer, f25, dialogue[0], 943, 68, "#fff4ff", { anchorX: 0.5 });
			createLabel(scene, resultLayer, f25, dialogue[1], 943, 103, "#fff4ff", { anchorX: 0.5 });

			const portraitPanel = createPanel(scene, resultLayer, 774, 232, 392, 446, "#170b25", qualified ? C.gold : C.pink, 0.94);
			portraitPanel.append(new g.FilledRect({ scene: scene, x: 10, y: 10, width: 372, height: 426, cssColor: qualified ? "#4b2451" : "#32163d", opacity: 0.48 }));
			portraitPanel.append(new g.Sprite({
				scene: scene,
				src: scene.asset.getImageById(qualified ? "portrait_hero_bust_happy" : "portrait_hero_bust_frustrated"),
				x: 40, y: 36, width: 312, height: 390
			}));
			if (storedData.bests[selectedStageIndex] == null || registeredScore > storedData.bests[selectedStageIndex]) {
				storedData.bests[selectedStageIndex] = registeredScore;
				writeStoredData();
			}
			if (!scoreSaved && g.game.requestSaveScore) { scoreSaved = true; g.game.requestSaveScore(g.game.vars.gameState.score); }
		}

		for (let i = 0; i < 4; ++i) (function (idx) { actionUi[idx].button.onPointDown.add(function () { resolvePlayer(idx); }); })(i);
		specialButton.onPointDown.add(function () { resolvePlayer(0); });
		updateTrendUi(); updateTimingZones(); refreshHud();
		titleLayer = createTitleUi({
			scene: scene,
			font: gameFont,
			initialSelected: selectedStageIndex,
			bests: storedData.bests,
			onSelect: function () { playSe("se_timing_normal", 0.44); },
			onStart: startSelectedStage
		});
		scene.append(titleLayer);
		startOpeningBgm();

		scene.onUpdate.add(function () {
			const dt = 1 / FPS;
			if (phase === "title") return;
			if (phase === "ready") {
				readyLeft -= dt;
				updateLabel(judgmentLabel, "▲タイミングよくいずれかのアクションを選択", C.gold);
				if (readyLeft <= 0) { phase = "play"; startStageBgm(currentStage.bgm); startTurn(); }
				refreshHud(); return;
			}
			if (phase === "end") return;
			turnElapsed += dt;
			for (let i = 0; i < plans.length; ++i) if (!plans[i].acted && turnElapsed >= plans[i].time) resolveAi(plans[i]);
			if (!midpointCommented && turnElapsed >= TURN_SECONDS / 2) { midpointCommented = true; midpointComments(); }
			for (let i = actionResultStates.length - 1; i >= 0; --i) {
				const fx = actionResultStates[i];
				fx.left -= dt;
				const progress = clamp((fx.duration - fx.left) / fx.duration, 0, 1);
				fx.entity.y = fx.startY - 42 * (1 - Math.pow(1 - progress, 2));
				fx.entity.opacity = clamp(fx.left / 0.30, 0, 1);
				if (fx.left <= 0) { fx.entity.hide(); actionResultStates.splice(i, 1); actionResultPool.push(fx); }
				else fx.entity.modified();
			}
			for (let i = judgeScoreStates.length - 1; i >= 0; --i) {
				const fx = judgeScoreStates[i];
				fx.left -= dt;
				const progress = clamp((fx.duration - fx.left) / fx.duration, 0, 1);
				fx.entity.y = fx.startY - 34 * progress;
				fx.entity.opacity = clamp(fx.left / 0.32, 0, 1);
				if (fx.left <= 0) { fx.entity.hide(); judgeScoreStates.splice(i, 1); judgeScorePool.push(fx); }
				else fx.entity.modified();
			}
			if (turnFxLeft > 0) {
				turnFxLeft -= dt;
				turnFx.opacity = clamp(turnFxLeft / 0.22, 0, 1);
				if (turnFxLeft <= 0) turnFx.hide();
				turnFx.modified();
			}
			if (competitionFxLeft > 0) {
				competitionFxLeft -= dt;
				const progress = clamp((competitionFxDuration - competitionFxLeft) / competitionFxDuration, 0, 1);
				competitionFx.y = competitionFxBaseY - 14 * progress;
				competitionFx.opacity = clamp(Math.min(progress * 5, competitionFxLeft / 0.24), 0, 1);
				competitionFx.scaleX += (1 - competitionFx.scaleX) * 0.24;
				competitionFx.scaleY += (1 - competitionFx.scaleY) * 0.24;
				if (competitionFxLeft <= 0) competitionFx.hide();
				competitionFx.modified();
			}
			for (let i = scoreTransferStates.length - 1; i >= 0; --i) {
				const fx = scoreTransferStates[i];
				fx.left -= dt;
				const progress = clamp((0.72 - fx.left) / 0.72, 0, 1);
				const eased = 1 - Math.pow(1 - progress, 2);
				fx.entity.x = fx.startX + (fx.endX - fx.startX) * eased;
				fx.entity.y = fx.startY + (fx.endY - fx.startY) * eased - Math.sin(progress * Math.PI) * 54;
				fx.entity.opacity = clamp(fx.left / 0.16, 0, 1);
				if (fx.left <= 0) { fx.entity.hide(); scoreTransferStates.splice(i, 1); scoreTransferPool.push(fx); } else fx.entity.modified();
			}
			for (let specialIndex = specialEffects.length - 1; specialIndex >= 0; --specialIndex) {
				const special = specialEffects[specialIndex];
				special.left -= dt;
				const specialProgress = clamp((1.65 - special.left) / 1.65, 0, 1);
				const enter = clamp(specialProgress / 0.18, 0, 1);
				const exit = clamp((specialProgress - 0.78) / 0.22, 0, 1);
				const enterEase = 1 - Math.pow(1 - enter, 3);
				if (exit > 0) special.panel.x = special.targetX + (special.exitX - special.targetX) * exit * exit;
				else special.panel.x = special.startX + (special.targetX - special.startX) * enterEase;
				special.panel.y = special.baseY - Math.sin(specialProgress * Math.PI) * 5;
				special.panel.opacity = clamp(Math.min(enter * 1.5, (1 - specialProgress) / 0.12), 0, 1);
				special.panel.modified();
				const auraScale = 0.9 + Math.sin(specialProgress * Math.PI * 3) * 0.06;
				special.aura.scaleX = auraScale;
				special.aura.scaleY = auraScale;
				const particleStep = Math.floor(specialProgress * 12);
				if (particleStep !== special.particleStep) {
					special.particleStep = particleStep;
					for (let i = 0; i < special.particles.length; ++i) {
						special.particles[i].opacity = 0.38 + ((i + particleStep) % 3) * 0.28;
						special.particles[i].modified();
					}
				}
				special.aura.opacity = clamp(Math.min(enter * 2, (1 - specialProgress) / 0.14), 0, 1);
				special.aura.modified();
				if (special.left <= 0) {
					special.panel.destroy();
					special.aura.destroy();
					specialEffects.splice(specialIndex, 1);
				}
			}
			if (specialEffects.length === 0) {
				if (specialFx.visible()) specialFx.hide();
				if (specialAuraLayer.visible()) specialAuraLayer.hide();
			}
			updateActorAnimations(dt);
			updateJudgeMotion(dt);
			if (turnElapsed >= TURN_SECONDS) {
				if (!playerActed) resolveMiss();
				for (let i = 0; i < plans.length; ++i) if (!plans[i].acted) resolveAi(plans[i]);
				if (turn >= TOTAL_TURNS) { refreshHud(); showResult(); return; }
				startTurn();
			}
			const kb = g.game.keyboard;
			if (kb && !playerActed) for (let code = 49; code <= 52; ++code) if (kb.getKeyDown(code)) { resolvePlayer(code - 49); break; }
			refreshHud();
		});
	});

	instanceStorage.read(STORAGE_KEY).then(function (value) {
		storedData = normalizeStorageData(value);
		g.game.pushScene(scene);
	}).catch(function () {
		storedData = normalizeStorageData(null);
		g.game.pushScene(scene);
	});
}

module.exports = main;
