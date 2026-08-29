"use strict";

function createLoadingScene() {
	const minimumDisplayMs = 1200;
	const scene = new g.LoadingScene({ game: g.game, assetIds: ["loading_pushup"], explicitEnd: true });
	let progressFill = null;
	let waitingAssets = 1;
	let loadedAssets = 0;
	let shownForMs = 0;
	let endScheduled = false;

	scene.onLoad.add(function () {
		scene.append(new g.FilledRect({
			scene: scene, width: g.game.width, height: g.game.height,
			cssColor: "#090414"
		}));
		scene.append(new g.FilledRect({
			scene: scene, y: g.game.height - 72, width: g.game.width, height: 72,
			cssColor: "#1a0a27", opacity: 0.96
		}));

		const accentColors = ["#ff4eb8", "#ffd35a", "#4ee7ff", "#b65cff"];
		const accentData = [
			[58, 112], [174, 62], [298, 154], [430, 92], [572, 138],
			[706, 72], [822, 132], [970, 84], [1110, 146], [1214, 96]
		];
		for (let i = 0; i < accentData.length; ++i) {
			const point = accentData[i];
			scene.append(new g.FilledRect({
				scene: scene, x: point[0], y: point[1], width: i % 3 === 0 ? 8 : 5, height: i % 3 === 0 ? 8 : 5,
				cssColor: accentColors[i % accentColors.length], angle: 45, opacity: 0.72
			}));
		}

		const sprite = new g.FrameSprite({
			scene: scene,
			src: scene.asset.getImageById("loading_pushup"),
			srcWidth: 400,
			srcHeight: 240,
			width: 400,
			height: 240,
			x: g.game.width - 420,
			y: g.game.height - 258,
			frames: [0, 1],
			interval: 300,
			loop: true
		});
		scene.append(sprite);
		sprite.start();

		const progressBack = new g.FilledRect({
			scene: scene, x: g.game.width - 412, y: g.game.height - 24,
			width: 384, height: 8, cssColor: "#351744", opacity: 0.9
		});
		progressFill = new g.FilledRect({
			scene: scene, x: progressBack.x, y: progressBack.y,
			width: 0, height: 8, cssColor: "#ff4eb8"
		});
		scene.append(progressBack);
		scene.append(progressFill);
	});

	scene.onTargetReset.add(function () {
		loadedAssets = 0;
		waitingAssets = Math.max(1, scene.getTargetWaitingAssetsCount());
		shownForMs = 0;
		endScheduled = false;
		if (progressFill) {
			progressFill.width = 0;
			progressFill.modified();
		}
	});

	scene.onTargetAssetLoad.add(function () {
		++loadedAssets;
		if (progressFill) {
			progressFill.width = Math.min(384, Math.round(384 * loadedAssets / waitingAssets));
			progressFill.modified();
		}
	});

	scene.onUpdate.add(function () {
		shownForMs += 1000 / g.game.fps;
	});

	scene.onTargetReady.add(function () {
		if (endScheduled) return;
		endScheduled = true;
		if (progressFill) {
			progressFill.width = 384;
			progressFill.modified();
		}
		const waitMs = Math.max(0, minimumDisplayMs - shownForMs);
		if (waitMs > 0) scene.setTimeout(function () { scene.end(); }, waitMs);
		else scene.end();
	});

	return scene;
}

module.exports = createLoadingScene;
