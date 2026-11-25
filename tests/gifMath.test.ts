import {describe, expect, it} from 'vitest';
import {
	applyBounceOrder,
	calculateOutputDimensions,
	clampVideoQuality,
	computeFrameTimestamps,
	formatBytes,
	formatTime,
	MAX_FRAMES,
	normalizePlayCount,
} from '../src/lib/gifMath.ts';

describe('calculateOutputDimensions', () => {
	it('preserves aspect ratio when scaling down', () => {
		expect(calculateOutputDimensions(1920, 1080, 480)).toEqual({
			width: 480,
			height: 270,
		});
	});

	it('avoids upscaling beyond source width by default', () => {
		expect(calculateOutputDimensions(320, 240, 800)).toEqual({
			width: 320,
			height: 240,
		});
	});

	it('allows upscaling when allowUpscale is true', () => {
		expect(calculateOutputDimensions(320, 240, 640, true)).toEqual({
			width: 640,
			height: 480,
		});
	});

	it('clamps to minimum dimensions', () => {
		expect(calculateOutputDimensions(100, 100, 4)).toEqual({
			width: 16,
			height: 16,
		});
	});

	it('throws on invalid source dimensions', () => {
		expect(() => calculateOutputDimensions(0, 100, 320)).toThrow(RangeError);
		expect(() => calculateOutputDimensions(100, -5, 320)).toThrow(RangeError);
	});
});

describe('computeFrameTimestamps', () => {
	it('generates uniform timestamps for normal speed', () => {
		const timestamps = computeFrameTimestamps(1, 2, 5, 1);
		expect(timestamps).toEqual([1, 1.2, 1.4, 1.6, 1.8, 2]);
	});

	it('advances faster in source time when speed > 1', () => {
		const timestamps = computeFrameTimestamps(0, 2, 5, 2);
		expect(timestamps).toEqual([0, 0.4, 0.8, 1.2, 1.6, 2]);
	});

	it('caps frame count at MAX_FRAMES by evenly sampling', () => {
		const timestamps = computeFrameTimestamps(0, 60, 30, 1);
		expect(timestamps).toHaveLength(MAX_FRAMES);
		expect(timestamps[0]).toBe(0);
		expect(timestamps.at(-1)).toBe(60);
	});

	it('returns single frame when start equals end', () => {
		expect(computeFrameTimestamps(2.5, 2.5, 12, 1)).toEqual([2.5]);
	});
});

describe('applyBounceOrder', () => {
	it('creates ping-pong sequence without duplicating endpoints', () => {
		expect(applyBounceOrder(['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c', 'd', 'c', 'b']);
	});

	it('returns a shallow copy unchanged for 2 or fewer frames', () => {
		expect(applyBounceOrder(['a'])).toEqual(['a']);
		expect(applyBounceOrder(['a', 'b'])).toEqual(['a', 'b']);
	});
});

describe('clampVideoQuality & normalizePlayCount', () => {
	it('clamps quality safely below 1.0 for video quantization', () => {
		expect(clampVideoQuality(1)).toBe(0.95);
		expect(clampVideoQuality(0.01)).toBe(0.1);
		expect(clampVideoQuality(0.75)).toBe(0.75);
		expect(clampVideoQuality(Number.NaN)).toBe(0.75);
	});

	it('normalizes play counts', () => {
		expect(normalizePlayCount('forever')).toBe('forever');
		expect(normalizePlayCount(0)).toBe(1);
		expect(normalizePlayCount(3.6)).toBe(4);
		expect(normalizePlayCount(100_000)).toBe(65_536);
	});
});

describe('formatters', () => {
	it('formats byte counts cleanly', () => {
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(2048)).toBe('2.0 KB');
		expect(formatBytes(1_572_864)).toBe('1.50 MB');
	});

	it('formats timestamps cleanly', () => {
		expect(formatTime(0)).toBe('0:00.0');
		expect(formatTime(4.25)).toBe('0:04.2');
		expect(formatTime(65.9)).toBe('1:05.9');
	});
});
