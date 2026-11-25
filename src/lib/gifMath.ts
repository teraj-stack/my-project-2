export const MIN_DIMENSION = 16;
export const MAX_DIMENSION = 1920;
export const MAX_FRAMES = 300;
export const MIN_QUALITY = 0.1;
export const MAX_VIDEO_QUALITY = 0.95;

export type OutputDimensions = {
	width: number;
	height: number;
};

export function calculateOutputDimensions(
	sourceWidth: number,
	sourceHeight: number,
	targetWidth: number,
	allowUpscale = false,
): OutputDimensions {
	if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
		throw new RangeError('Source dimensions must be positive finite numbers.');
	}

	const maxAllowedWidth = allowUpscale
		? MAX_DIMENSION
		: Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.round(sourceWidth)));

	const clampedTarget = Number.isFinite(targetWidth) ? Math.round(targetWidth) : Math.round(sourceWidth);
	const width = Math.min(maxAllowedWidth, Math.max(MIN_DIMENSION, clampedTarget));
	const aspectRatio = sourceHeight / sourceWidth;
	const height = Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.round(width * aspectRatio)));

	return {width, height};
}

export function computeFrameTimestamps(
	startSec: number,
	endSec: number,
	fps: number,
	speed = 1,
	maxFrames = MAX_FRAMES,
): number[] {
	const safeStart = Number.isFinite(startSec) ? Math.max(0, startSec) : 0;
	const safeEnd = Number.isFinite(endSec) ? Math.max(safeStart, endSec) : safeStart;
	const safeFps = Number.isFinite(fps) ? Math.max(1, Math.min(50, fps)) : 12;
	const safeSpeed = Number.isFinite(speed) ? Math.max(0.25, Math.min(4, speed)) : 1;
	const safeMaxFrames = Math.max(1, Math.floor(maxFrames));

	const duration = safeEnd - safeStart;
	if (duration <= 1e-4) {
		return [Number(safeStart.toFixed(4))];
	}

	const sourceStep = safeSpeed / safeFps;
	const rawCount = Math.floor(duration / sourceStep) + 1;

	if (rawCount <= safeMaxFrames) {
		const timestamps: number[] = [];
		for (let index = 0; index < rawCount; index++) {
			const time = safeStart + (index * sourceStep);
			if (time <= safeEnd + 1e-6) {
				timestamps.push(Number(Math.min(time, safeEnd).toFixed(4)));
			}
		}

		return timestamps.length > 0 ? timestamps : [Number(safeStart.toFixed(4))];
	}

	// Evenly sample across [safeStart, safeEnd] when exceeding maxFrames
	const timestamps: number[] = [];
	const span = safeMaxFrames > 1 ? duration / (safeMaxFrames - 1) : 0;
	for (let index = 0; index < safeMaxFrames; index++) {
		timestamps.push(Number((safeStart + (index * span)).toFixed(4)));
	}

	return timestamps;
}

export function applyBounceOrder<T>(frames: readonly T[]): T[] {
	if (frames.length <= 2) {
		return [...frames];
	}

	const middleReversed = frames.slice(1, -1).reverse();
	return [...frames, ...middleReversed];
}

export function clampVideoQuality(quality: number): number {
	if (!Number.isFinite(quality)) {
		return 0.75;
	}

	const clamped = Math.min(MAX_VIDEO_QUALITY, Math.max(MIN_QUALITY, quality));
	return Math.round(clamped * 100) / 100;
}

export function normalizePlayCount(value: 'forever' | number): 'forever' | number {
	if (value === 'forever') {
		return 'forever';
	}

	if (!Number.isFinite(value)) {
		return 'forever';
	}

	return Math.min(65_536, Math.max(1, Math.round(value)));
}

export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes < 0) {
		return '0 B';
	}

	if (bytes < 1024) {
		return `${Math.round(bytes)} B`;
	}

	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}

	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) {
		return '0:00.0';
	}

	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	const wholeSecs = Math.floor(secs);
	const tenths = Math.floor((secs - wholeSecs) * 10);
	return `${mins}:${String(wholeSecs).padStart(2, '0')}.${tenths}`;
}
