import {describe, expect, it} from 'vitest';
import {decodeGifFile, encodeFramesToGif, rescaleRgbaFrame} from '../src/lib/gifCodec.ts';

function makeSolidFrame(width: number, height: number, rgba: [number, number, number, number]): Uint8ClampedArray {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let index = 0; index < data.length; index += 4) {
		data[index] = rgba[0];
		data[index + 1] = rgba[1];
		data[index + 2] = rgba[2];
		data[index + 3] = rgba[3];
	}

	return data;
}

function makeGradientFrame(width: number, height: number, offset: number): Uint8ClampedArray {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const idx = ((y * width) + x) * 4;
			data[idx] = (x * 13 + offset) % 256;
			data[idx + 1] = (y * 17 + offset) % 256;
			data[idx + 2] = ((x + y) * 9 + offset) % 256;
			data[idx + 3] = 255;
		}
	}

	return data;
}

describe('gifCodec (@sindresorhus/gifkit integration)', () => {
	it('encodes RGBA frames into a valid GIF89a and round-trips via decodeGifFile', () => {
		const width = 32;
		const height = 24;
		const frames = [
			makeGradientFrame(width, height, 0),
			makeGradientFrame(width, height, 40),
			makeGradientFrame(width, height, 80),
		];

		const encoded = encodeFramesToGif({
			frames,
			width,
			height,
			fps: 10,
			quality: 0.75,
			playCount: 'forever',
			bounce: false,
		});

		const header = new TextDecoder().decode(encoded.bytes.slice(0, 6));
		expect(header).toBe('GIF89a');
		expect(encoded.frameCount).toBe(3);
		expect(encoded.width).toBe(width);
		expect(encoded.height).toBe(height);

		const decoded = decodeGifFile(encoded.bytes);
		expect(decoded.width).toBe(width);
		expect(decoded.height).toBe(height);
		expect(decoded.frames).toHaveLength(3);
		expect(decoded.playCount).toBe('forever');
		expect(decoded.averageFps).toBe(10);
	});

	it('applies bounce frame ordering when bounce is enabled', () => {
		const width = 16;
		const height = 16;
		const frames = [
			makeSolidFrame(width, height, [255, 0, 0, 255]),
			makeSolidFrame(width, height, [0, 255, 0, 255]),
			makeSolidFrame(width, height, [0, 0, 255, 255]),
		];

		const encoded = encodeFramesToGif({
			frames,
			width,
			height,
			fps: 12,
			quality: 0.8,
			playCount: 2,
			bounce: true,
		});

		expect(encoded.frameCount).toBe(4);
		const decoded = decodeGifFile(encoded.bytes);
		expect(decoded.frames).toHaveLength(4);
		expect(decoded.playCount).toBe(2);
	});

	it('throws when given zero frames', () => {
		expect(() => encodeFramesToGif({
			frames: [],
			width: 16,
			height: 16,
			fps: 10,
			quality: 0.75,
			playCount: 'forever',
		})).toThrow();
	});

	it('rescales RGBA frames cleanly', () => {
		const src = makeSolidFrame(4, 4, [100, 150, 200, 255]);
		const resized = rescaleRgbaFrame(src, 4, 4, 2, 2);
		expect(resized).toHaveLength(2 * 2 * 4);
		expect([...resized.slice(0, 4)]).toEqual([100, 150, 200, 255]);
	});
});
