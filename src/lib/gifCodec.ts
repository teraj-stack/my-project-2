import {decodeAnimatedGIF, encodeAnimatedGIF, type GIFPlayCount} from '@sindresorhus/gifkit';
import {applyBounceOrder, clampVideoQuality, normalizePlayCount} from './gifMath.ts';

export type EncodeGifInput = {
	frames: Uint8ClampedArray[];
	width: number;
	height: number;
	fps: number;
	quality: number;
	playCount: GIFPlayCount;
	bounce?: boolean;
	exactColors?: boolean;
};

export type EncodeGifResult = {
	bytes: Uint8Array;
	frameCount: number;
	width: number;
	height: number;
	durationSeconds: number;
};

export type DecodedGifFrame = {
	pixels: Uint8ClampedArray;
	delay: number;
};

export type DecodedGifSummary = {
	width: number;
	height: number;
	playCount?: GIFPlayCount;
	frames: DecodedGifFrame[];
	durationSeconds: number;
	averageFps: number;
};

export function encodeFramesToGif(input: EncodeGifInput): EncodeGifResult {
	if (input.frames.length === 0) {
		throw new Error('At least one frame is required to encode a GIF.');
	}

	const orderedFrames = input.bounce ? applyBounceOrder(input.frames) : input.frames;
	const safeFps = Math.max(1, Math.min(50, Math.round(input.fps)));
	const safeQuality = input.exactColors ? 1 : clampVideoQuality(input.quality);
	const safePlayCount = normalizePlayCount(input.playCount);

	const bytes = encodeAnimatedGIF(orderedFrames, {
		width: input.width,
		height: input.height,
		fps: safeFps,
		playCount: safePlayCount,
		quality: safeQuality,
	});

	return {
		bytes,
		frameCount: orderedFrames.length,
		width: input.width,
		height: input.height,
		durationSeconds: orderedFrames.length / safeFps,
	};
}

export function decodeGifFile(bytes: Uint8Array): DecodedGifSummary {
	const decoded = decodeAnimatedGIF(bytes, {strict: false});
	const durationSeconds = decoded.frames.reduce((sum, frame) => {
		const effectiveDelay = frame.delay > 0 ? frame.delay : 0.1;
		return sum + effectiveDelay;
	}, 0);

	const averageFps = durationSeconds > 0
		? Math.max(1, Math.min(50, Math.round(decoded.frames.length / durationSeconds)))
		: 10;

	return {
		width: decoded.width,
		height: decoded.height,
		playCount: decoded.playCount,
		frames: decoded.frames.map(frame => ({
			pixels: frame.pixels,
			delay: frame.delay,
		})),
		durationSeconds,
		averageFps,
	};
}

/**
 * Pure bilinear RGBA image resizer that works identically in Web Workers and Node.js.
 */
export function rescaleRgbaFrame(
	pixels: Uint8ClampedArray,
	srcWidth: number,
	srcHeight: number,
	dstWidth: number,
	dstHeight: number,
): Uint8ClampedArray {
	if (srcWidth === dstWidth && srcHeight === dstHeight) {
		return new Uint8ClampedArray(pixels);
	}

	const output = new Uint8ClampedArray(dstWidth * dstHeight * 4);
	const xRatio = srcWidth > 1 && dstWidth > 1 ? (srcWidth - 1) / (dstWidth - 1) : 0;
	const yRatio = srcHeight > 1 && dstHeight > 1 ? (srcHeight - 1) / (dstHeight - 1) : 0;

	for (let y = 0; y < dstHeight; y++) {
		const srcY = y * yRatio;
		const y0 = Math.floor(srcY);
		const y1 = Math.min(srcHeight - 1, y0 + 1);
		const yWeight = srcY - y0;

		for (let x = 0; x < dstWidth; x++) {
			const srcX = x * xRatio;
			const x0 = Math.floor(srcX);
			const x1 = Math.min(srcWidth - 1, x0 + 1);
			const xWeight = srcX - x0;

			const idx00 = ((y0 * srcWidth) + x0) * 4;
			const idx10 = ((y0 * srcWidth) + x1) * 4;
			const idx01 = ((y1 * srcWidth) + x0) * 4;
			const idx11 = ((y1 * srcWidth) + x1) * 4;

			const dstIdx = ((y * dstWidth) + x) * 4;

			for (let channel = 0; channel < 4; channel++) {
				const top = pixels[idx00 + channel] + ((pixels[idx10 + channel] - pixels[idx00 + channel]) * xWeight);
				const bottom = pixels[idx01 + channel] + ((pixels[idx11 + channel] - pixels[idx01 + channel]) * xWeight);
				output[dstIdx + channel] = Math.round(top + ((bottom - top) * yWeight));
			}
		}
	}

	return output;
}
