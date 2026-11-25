import {computeFrameTimestamps} from './gifMath.ts';

export type ExtractVideoFramesOptions = {
	startSec: number;
	endSec: number;
	fps: number;
	speed: number;
	width: number;
	height: number;
	signal?: AbortSignal;
	onProgress?: (current: number, total: number) => void;
};

function seekVideo(video: HTMLVideoElement, targetTime: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException('Frame extraction aborted', 'AbortError'));
			return;
		}

		const clampedTime = Math.max(0, Math.min(targetTime, Number.isFinite(video.duration) ? video.duration : targetTime));

		if (Math.abs(video.currentTime - clampedTime) < 0.001 && video.readyState >= 2) {
			resolve();
			return;
		}

		const onSeeked = () => {
			cleanup();
			resolve();
		};

		const onError = () => {
			cleanup();
			reject(new Error('Failed to seek video frame.'));
		};

		const onAbort = () => {
			cleanup();
			reject(new DOMException('Frame extraction aborted', 'AbortError'));
		};

		const cleanup = () => {
			video.removeEventListener('seeked', onSeeked);
			video.removeEventListener('error', onError);
			signal?.removeEventListener('abort', onAbort);
		};

		video.addEventListener('seeked', onSeeked, {once: true});
		video.addEventListener('error', onError, {once: true});
		signal?.addEventListener('abort', onAbort, {once: true});

		video.currentTime = clampedTime;
	});
}

export async function extractVideoFrames(
	video: HTMLVideoElement,
	options: ExtractVideoFramesOptions,
): Promise<Uint8ClampedArray[]> {
	const timestamps = computeFrameTimestamps(
		options.startSec,
		options.endSec,
		options.fps,
		options.speed,
	);

	video.pause();

	const canvas = document.createElement('canvas');
	canvas.width = options.width;
	canvas.height = options.height;

	const context = canvas.getContext('2d', {willReadFrequently: true});
	if (!context) {
		throw new Error('Could not initialize 2D canvas context.');
	}

	const frames: Uint8ClampedArray[] = [];

	for (let index = 0; index < timestamps.length; index++) {
		if (options.signal?.aborted) {
			throw new DOMException('Frame extraction aborted', 'AbortError');
		}

		await seekVideo(video, timestamps[index], options.signal);

		context.clearRect(0, 0, options.width, options.height);
		context.drawImage(video, 0, 0, options.width, options.height);
		const imageData = context.getImageData(0, 0, options.width, options.height);
		frames.push(new Uint8ClampedArray(imageData.data));

		options.onProgress?.(index + 1, timestamps.length);
	}

	return frames;
}
