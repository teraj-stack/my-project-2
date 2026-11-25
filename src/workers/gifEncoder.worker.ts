import type {GIFPlayCount} from '@sindresorhus/gifkit';
import {decodeGifFile, encodeFramesToGif, rescaleRgbaFrame} from '../lib/gifCodec.ts';

export type WorkerEncodeRequest = {
	id: number;
	type: 'encode';
	frames: ArrayBuffer[];
	width: number;
	height: number;
	fps: number;
	quality: number;
	playCount: GIFPlayCount;
	bounce: boolean;
};

export type WorkerDecodeRequest = {
	id: number;
	type: 'decode';
	bytes: ArrayBuffer;
};

export type WorkerReencodeGifRequest = {
	id: number;
	type: 'reencode';
	bytes: ArrayBuffer;
	startFrame: number;
	endFrame: number;
	targetWidth: number;
	targetHeight: number;
	fps: number;
	quality: number;
	playCount: GIFPlayCount;
	bounce: boolean;
};

export type WorkerRequest = WorkerEncodeRequest | WorkerDecodeRequest | WorkerReencodeGifRequest;

export type WorkerEncodedResponse = {
	id: number;
	type: 'encoded';
	bytes: ArrayBuffer;
	frameCount: number;
	width: number;
	height: number;
	durationSeconds: number;
};

export type WorkerDecodedResponse = {
	id: number;
	type: 'decoded';
	width: number;
	height: number;
	frameCount: number;
	durationSeconds: number;
	averageFps: number;
	playCount?: GIFPlayCount;
};

export type WorkerErrorResponse = {
	id: number;
	type: 'error';
	message: string;
};

export type WorkerResponse = WorkerEncodedResponse | WorkerDecodedResponse | WorkerErrorResponse;

type WorkerGlobal = {
	onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
	postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
};

const workerScope = self as unknown as WorkerGlobal;

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
	const request = event.data;

	try {
		if (request.type === 'encode') {
			const frames = request.frames.map(buffer => new Uint8ClampedArray(buffer));
			const result = encodeFramesToGif({
				frames,
				width: request.width,
				height: request.height,
				fps: request.fps,
				quality: request.quality,
				playCount: request.playCount,
				bounce: request.bounce,
			});

			const transferableBuffer = result.bytes.buffer.slice(
				result.bytes.byteOffset,
				result.bytes.byteOffset + result.bytes.byteLength,
			) as ArrayBuffer;

			workerScope.postMessage(
				{
					id: request.id,
					type: 'encoded',
					bytes: transferableBuffer,
					frameCount: result.frameCount,
					width: result.width,
					height: result.height,
					durationSeconds: result.durationSeconds,
				},
				[transferableBuffer],
			);
			return;
		}

		if (request.type === 'decode') {
			const summary = decodeGifFile(new Uint8Array(request.bytes));
			workerScope.postMessage({
				id: request.id,
				type: 'decoded',
				width: summary.width,
				height: summary.height,
				frameCount: summary.frames.length,
				durationSeconds: summary.durationSeconds,
				averageFps: summary.averageFps,
				playCount: summary.playCount,
			});
			return;
		}

		if (request.type === 'reencode') {
			const summary = decodeGifFile(new Uint8Array(request.bytes));
			const start = Math.max(0, Math.min(summary.frames.length - 1, request.startFrame));
			const end = Math.max(start, Math.min(summary.frames.length - 1, request.endFrame));
			const sliced = summary.frames.slice(start, end + 1);

			const resizedFrames = sliced.map(frame =>
				rescaleRgbaFrame(
					frame.pixels,
					summary.width,
					summary.height,
					request.targetWidth,
					request.targetHeight,
				),
			);

			const result = encodeFramesToGif({
				frames: resizedFrames,
				width: request.targetWidth,
				height: request.targetHeight,
				fps: request.fps,
				quality: request.quality,
				playCount: request.playCount,
				bounce: request.bounce,
			});

			const transferableBuffer = result.bytes.buffer.slice(
				result.bytes.byteOffset,
				result.bytes.byteOffset + result.bytes.byteLength,
			) as ArrayBuffer;

			workerScope.postMessage(
				{
					id: request.id,
					type: 'encoded',
					bytes: transferableBuffer,
					frameCount: result.frameCount,
					width: result.width,
					height: result.height,
					durationSeconds: result.durationSeconds,
				},
				[transferableBuffer],
			);
		}
	} catch (error) {
		workerScope.postMessage({
			id: request.id,
			type: 'error',
			message: error instanceof Error ? error.message : String(error),
		});
	}
};
