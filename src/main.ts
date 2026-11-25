import type {GIFPlayCount} from '@sindresorhus/gifkit';
import {
	calculateOutputDimensions,
	computeFrameTimestamps,
	formatBytes,
	formatTime,
	MAX_FRAMES,
} from './lib/gifMath.ts';
import {extractVideoFrames} from './lib/videoExtractor.ts';
import type {
	WorkerDecodedResponse,
	WorkerEncodedResponse,
	WorkerRequest,
	WorkerResponse,
} from './workers/gifEncoder.worker.ts';

type AppMode = 'video' | 'gif';

type SourceState =
	| {
		kind: 'video';
		file: File;
		objectUrl: string;
		width: number;
		height: number;
		duration: number;
	}
	| {
		kind: 'gif';
		file: File;
		objectUrl: string;
		bytes: Uint8Array;
		width: number;
		height: number;
		frameCount: number;
		duration: number;
		averageFps: number;
	};

function requireElement<T extends HTMLElement>(id: string): T {
	const element = document.getElementById(id);
	if (!element) {
		throw new Error(`Missing required element #${id}`);
	}

	return element as T;
}

const modeVideoBtn = requireElement<HTMLButtonElement>('mode-video-btn');
const modeGifBtn = requireElement<HTMLButtonElement>('mode-gif-btn');
const dropzone = requireElement<HTMLElement>('dropzone');
const fileInput = requireElement<HTMLInputElement>('file-input');
const dropzoneTitle = requireElement<HTMLElement>('dropzone-title');
const dropzoneSubtitle = requireElement<HTMLElement>('dropzone-subtitle');
const errorBanner = requireElement<HTMLElement>('error-banner');
const workspace = requireElement<HTMLElement>('workspace');
const fileNameEl = requireElement<HTMLElement>('file-name');
const fileMetaEl = requireElement<HTMLElement>('file-meta');
const changeFileBtn = requireElement<HTMLButtonElement>('change-file-btn');

const videoPreviewWrap = requireElement<HTMLElement>('video-preview-wrap');
const sourceVideo = requireElement<HTMLVideoElement>('source-video');
const trimStartRange = requireElement<HTMLInputElement>('trim-start-range');
const trimEndRange = requireElement<HTMLInputElement>('trim-end-range');
const trimStartLabel = requireElement<HTMLElement>('trim-start-label');
const trimEndLabel = requireElement<HTMLElement>('trim-end-label');
const trimDurationLabel = requireElement<HTMLElement>('trim-duration-label');

const gifPreviewWrap = requireElement<HTMLElement>('gif-preview-wrap');
const sourceGifImg = requireElement<HTMLImageElement>('source-gif-img');
const gifStartFrame = requireElement<HTMLInputElement>('gif-start-frame');
const gifEndFrame = requireElement<HTMLInputElement>('gif-end-frame');
const gifFrameRangeLabel = requireElement<HTMLElement>('gif-frame-range-label');

const widthInput = requireElement<HTMLInputElement>('width-input');
const widthPresetButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-width]')];
const outputDimensionsBadge = requireElement<HTMLElement>('output-dimensions-badge');
const fpsRange = requireElement<HTMLInputElement>('fps-range');
const fpsValue = requireElement<HTMLElement>('fps-value');
const qualityRange = requireElement<HTMLInputElement>('quality-range');
const qualityValue = requireElement<HTMLElement>('quality-value');
const speedSelect = requireElement<HTMLSelectElement>('speed-select');
const loopSelect = requireElement<HTMLSelectElement>('loop-select');
const customLoopWrap = requireElement<HTMLElement>('custom-loop-wrap');
const customLoopInput = requireElement<HTMLInputElement>('custom-loop-input');
const bounceCheckbox = requireElement<HTMLInputElement>('bounce-checkbox');
const estimateBadge = requireElement<HTMLElement>('estimate-badge');

const convertBtn = requireElement<HTMLButtonElement>('convert-btn');
const cancelBtn = requireElement<HTMLButtonElement>('cancel-btn');
const progressPanel = requireElement<HTMLElement>('progress-panel');
const progressLabel = requireElement<HTMLElement>('progress-label');
const progressPercent = requireElement<HTMLElement>('progress-percent');
const progressBarFill = requireElement<HTMLElement>('progress-bar-fill');

const resultCard = requireElement<HTMLElement>('result-card');
const resultGifImg = requireElement<HTMLImageElement>('result-gif-img');
const downloadBtn = requireElement<HTMLAnchorElement>('download-btn');
const statSize = requireElement<HTMLElement>('stat-size');
const statDimensions = requireElement<HTMLElement>('stat-dimensions');
const statFrames = requireElement<HTMLElement>('stat-frames');
const statDuration = requireElement<HTMLElement>('stat-duration');

let activeMode: AppMode = 'video';
let sourceState: SourceState | null = null;
let resultObjectUrl: string | null = null;
let activeAbortController: AbortController | null = null;
let worker: Worker | null = null;
let nextRequestId = 1;
const pendingWorkerCalls = new Map<number, {
	resolve: (response: WorkerResponse) => void;
	reject: (error: Error) => void;
}>();

function getOrCreateWorker(): Worker {
	if (!worker) {
		worker = new Worker(new URL('./workers/gifEncoder.worker.ts', import.meta.url), {
			type: 'module',
		});

		worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
			const response = event.data;
			const pending = pendingWorkerCalls.get(response.id);
			if (!pending) {
				return;
			}

			pendingWorkerCalls.delete(response.id);
			if (response.type === 'error') {
				pending.reject(new Error(response.message));
			} else {
				pending.resolve(response);
			}
		};

		worker.onerror = event => {
			const err = new Error(event.message || 'Błąd Web Workera podczas przetwarzania GIF.');
			for (const pending of pendingWorkerCalls.values()) {
				pending.reject(err);
			}

			pendingWorkerCalls.clear();
		};
	}

	return worker;
}

function resetWorker(): void {
	if (worker) {
		worker.terminate();
		worker = null;
	}

	const cancelledError = new DOMException('Przetwarzanie anulowane.', 'AbortError');
	for (const pending of pendingWorkerCalls.values()) {
		pending.reject(cancelledError);
	}

	pendingWorkerCalls.clear();
}

function callWorker<T extends WorkerResponse>(
	request: WorkerRequest,
	transfer: Transferable[] = [],
): Promise<T> {
	const currentWorker = getOrCreateWorker();
	return new Promise<T>((resolve, reject) => {
		pendingWorkerCalls.set(request.id, {
			resolve: response => resolve(response as T),
			reject,
		});
		currentWorker.postMessage(request, transfer);
	});
}

function showError(message: string): void {
	errorBanner.textContent = message;
	errorBanner.hidden = false;
}

function clearError(): void {
	errorBanner.textContent = '';
	errorBanner.hidden = true;
}

function revokeResultUrl(): void {
	if (resultObjectUrl) {
		URL.revokeObjectURL(resultObjectUrl);
		resultObjectUrl = null;
	}
}

function clearSource(): void {
	if (sourceState) {
		URL.revokeObjectURL(sourceState.objectUrl);
		sourceState = null;
	}

	sourceVideo.removeAttribute('src');
	sourceVideo.load();
	sourceGifImg.removeAttribute('src');
	revokeResultUrl();
	resultCard.hidden = true;
	workspace.hidden = true;
	dropzone.hidden = false;
}

function setMode(mode: AppMode): void {
	if (activeAbortController) {
		return;
	}

	activeMode = mode;
	modeVideoBtn.classList.toggle('is-active', mode === 'video');
	modeVideoBtn.setAttribute('aria-selected', String(mode === 'video'));
	modeGifBtn.classList.toggle('is-active', mode === 'gif');
	modeGifBtn.setAttribute('aria-selected', String(mode === 'gif'));

	if (mode === 'video') {
		fileInput.accept = 'video/*,.mp4,.webm,.mov,.m4v';
		dropzoneTitle.textContent = 'Przeciągnij plik wideo tutaj';
		dropzoneSubtitle.textContent = 'lub kliknij, aby wybrać (.mp4, .webm, .mov) — plik nie opuszcza Twojego urządzenia';
		convertBtn.textContent = 'Konwertuj na GIF';
	} else {
		fileInput.accept = 'image/gif,.gif';
		dropzoneTitle.textContent = 'Przeciągnij plik GIF tutaj';
		dropzoneSubtitle.textContent = 'lub kliknij, aby wybrać (.gif) — zmień rozmiar, prędkość, zakres klatek i jakość';
		convertBtn.textContent = 'Optymalizuj GIF';
	}

	clearError();
	clearSource();
}

function getSelectedPlayCount(): GIFPlayCount {
	if (loopSelect.value === 'forever') {
		return 'forever';
	}

	if (loopSelect.value === 'custom') {
		return Math.max(1, Math.min(65_536, Number.parseInt(customLoopInput.value, 10) || 1));
	}

	return Number.parseInt(loopSelect.value, 10) || 1;
}

function updatePresetHighlight(targetWidth: number): void {
	for (const button of widthPresetButtons) {
		const preset = Number.parseInt(button.dataset.width ?? '0', 10);
		button.classList.toggle('is-active', preset === targetWidth);
	}
}

function updateDerivedUI(): void {
	if (!sourceState) {
		return;
	}

	const targetWidth = Number.parseInt(widthInput.value, 10) || sourceState.width;
	updatePresetHighlight(targetWidth);

	const dims = calculateOutputDimensions(sourceState.width, sourceState.height, targetWidth);
	outputDimensionsBadge.textContent = `${dims.width} × ${dims.height}`;

	const fps = Number.parseInt(fpsRange.value, 10);
	fpsValue.textContent = `${fps} FPS`;

	const qualityPct = Number.parseInt(qualityRange.value, 10);
	qualityValue.textContent = `${qualityPct}%`;

	const bounce = bounceCheckbox.checked;

	if (sourceState.kind === 'video') {
		const startSec = Number.parseFloat(trimStartRange.value);
		const endSec = Number.parseFloat(trimEndRange.value);
		const speed = Number.parseFloat(speedSelect.value) || 1;

		trimStartLabel.textContent = formatTime(startSec);
		trimEndLabel.textContent = formatTime(endSec);
		trimDurationLabel.textContent = formatTime(Math.max(0, endSec - startSec));

		const timestamps = computeFrameTimestamps(startSec, endSec, fps, speed);
		const effectiveFrames = bounce && timestamps.length > 2
			? (timestamps.length * 2) - 2
			: timestamps.length;

		const capNotice = timestamps.length >= MAX_FRAMES ? ` (limit ${MAX_FRAMES} klatek źródłowych)` : '';
		estimateBadge.textContent = `Szacowana liczba klatek: ${effectiveFrames}${capNotice}`;
	} else {
		const startIdx = Number.parseInt(gifStartFrame.value, 10);
		const endIdx = Number.parseInt(gifEndFrame.value, 10);
		gifFrameRangeLabel.textContent = `${startIdx} – ${endIdx}`;

		const baseCount = Math.max(1, endIdx - startIdx + 1);
		const effectiveFrames = bounce && baseCount > 2 ? (baseCount * 2) - 2 : baseCount;
		estimateBadge.textContent = `Wybrane klatki do zapisu: ${effectiveFrames}`;
	}
}

function loadVideoMetadata(video: HTMLVideoElement, url: string): Promise<{width: number; height: number; duration: number}> {
	return new Promise((resolve, reject) => {
		const onLoaded = () => {
			cleanup();
			resolve({
				width: video.videoWidth,
				height: video.videoHeight,
				duration: Number.isFinite(video.duration) ? video.duration : 0,
			});
		};

		const onError = () => {
			cleanup();
			reject(new Error('Nie udało się odczytać tego pliku wideo. Spróbuj formatu MP4 lub WebM.'));
		};

		const cleanup = () => {
			video.removeEventListener('loadedmetadata', onLoaded);
			video.removeEventListener('error', onError);
		};

		video.addEventListener('loadedmetadata', onLoaded, {once: true});
		video.addEventListener('error', onError, {once: true});
		video.src = url;
		video.load();
	});
}

async function handleSelectedFile(file: File): Promise<void> {
	clearError();

	const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
	const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name);

	if (isGif && activeMode !== 'gif') {
		setMode('gif');
	} else if (isVideo && activeMode !== 'video') {
		setMode('video');
	}

	if (!isGif && !isVideo) {
		showError('Nieobsługiwany format pliku. Wybierz plik wideo (.mp4, .webm, .mov) lub plik .gif.');
		return;
	}

	clearSource();

	const objectUrl = URL.createObjectURL(file);

	try {
		if (isVideo) {
			const meta = await loadVideoMetadata(sourceVideo, objectUrl);
			if (meta.width <= 0 || meta.height <= 0 || meta.duration <= 0) {
				throw new Error('Wybrany plik wideo nie zawiera prawidłowego strumienia obrazu.');
			}

			sourceState = {
				kind: 'video',
				file,
				objectUrl,
				width: meta.width,
				height: meta.height,
				duration: meta.duration,
			};

			videoPreviewWrap.hidden = false;
			gifPreviewWrap.hidden = true;

			const maxEnd = Math.max(0.1, Number(meta.duration.toFixed(1)));
			const defaultEnd = Math.min(maxEnd, 10);

			trimStartRange.min = '0';
			trimStartRange.max = String(maxEnd);
			trimStartRange.value = '0';

			trimEndRange.min = '0';
			trimEndRange.max = String(maxEnd);
			trimEndRange.value = String(defaultEnd);

			widthInput.value = String(Math.min(480, meta.width));
			fpsRange.value = '14';
			speedSelect.value = '1';

			fileNameEl.textContent = file.name;
			fileMetaEl.textContent = `${meta.width} × ${meta.height} • ${formatTime(meta.duration)} • ${formatBytes(file.size)}`;
		} else {
			const buffer = await file.arrayBuffer();
			const bytes = new Uint8Array(buffer);
			const copyForWorker = buffer.slice(0);

			const decoded = await callWorker<WorkerDecodedResponse>(
				{
					id: nextRequestId++,
					type: 'decode',
					bytes: copyForWorker,
				},
				[copyForWorker],
			);

			sourceState = {
				kind: 'gif',
				file,
				objectUrl,
				bytes,
				width: decoded.width,
				height: decoded.height,
				frameCount: decoded.frameCount,
				duration: decoded.durationSeconds,
				averageFps: decoded.averageFps,
			};

			videoPreviewWrap.hidden = true;
			gifPreviewWrap.hidden = false;
			sourceGifImg.src = objectUrl;

			gifStartFrame.min = '1';
			gifStartFrame.max = String(Math.max(1, decoded.frameCount));
			gifStartFrame.value = '1';

			gifEndFrame.min = '1';
			gifEndFrame.max = String(Math.max(1, decoded.frameCount));
			gifEndFrame.value = String(Math.max(1, decoded.frameCount));

			widthInput.value = String(Math.min(480, decoded.width));
			fpsRange.value = String(Math.max(5, Math.min(30, decoded.averageFps)));
			speedSelect.value = '1';

			fileNameEl.textContent = file.name;
			fileMetaEl.textContent = `${decoded.width} × ${decoded.height} • ${decoded.frameCount} klatek • ${formatBytes(file.size)}`;
		}

		dropzone.hidden = true;
		workspace.hidden = false;
		resultCard.hidden = true;
		updateDerivedUI();
	} catch (error) {
		URL.revokeObjectURL(objectUrl);
		showError(error instanceof Error ? error.message : 'Wystąpił nieznany błąd podczas wczytywania pliku.');
	}
}

function setProgress(label: string, percent: number): void {
	const clamped = Math.max(0, Math.min(100, Math.round(percent)));
	progressPanel.hidden = false;
	progressLabel.textContent = label;
	progressPercent.textContent = `${clamped}%`;
	progressBarFill.style.width = `${clamped}%`;
}

function setBusy(isBusy: boolean): void {
	convertBtn.disabled = isBusy;
	changeFileBtn.disabled = isBusy;
	cancelBtn.hidden = !isBusy;
	if (!isBusy) {
		progressPanel.hidden = true;
	}
}

async function runConversion(): Promise<void> {
	if (!sourceState || activeAbortController) {
		return;
	}

	clearError();
	resultCard.hidden = true;
	revokeResultUrl();

	const abortController = new AbortController();
	activeAbortController = abortController;
	setBusy(true);

	try {
		const targetWidth = Number.parseInt(widthInput.value, 10) || sourceState.width;
		const {width, height} = calculateOutputDimensions(sourceState.width, sourceState.height, targetWidth);
		const baseFps = Number.parseInt(fpsRange.value, 10) || 14;
		const speed = Number.parseFloat(speedSelect.value) || 1;
		const quality = (Number.parseInt(qualityRange.value, 10) || 75) / 100;
		const playCount = getSelectedPlayCount();
		const bounce = bounceCheckbox.checked;

		let encoded: WorkerEncodedResponse;

		if (sourceState.kind === 'video') {
			const startSec = Number.parseFloat(trimStartRange.value);
			const endSec = Number.parseFloat(trimEndRange.value);

			setProgress('Ekstrakcja klatek z wideo…', 5);
			const frames = await extractVideoFrames(sourceVideo, {
				startSec,
				endSec,
				fps: baseFps,
				speed,
				width,
				height,
				signal: abortController.signal,
				onProgress(current, total) {
					const pct = 5 + ((current / total) * 65);
					setProgress(`Ekstrakcja klatek (${current}/${total})…`, pct);
				},
			});

			setProgress('Kodowanie pliku GIF w Web Workerze…', 78);
			const buffers = frames.map(frame => frame.buffer as ArrayBuffer);

			encoded = await callWorker<WorkerEncodedResponse>(
				{
					id: nextRequestId++,
					type: 'encode',
					frames: buffers,
					width,
					height,
					fps: baseFps,
					quality,
					playCount,
					bounce,
				},
				buffers,
			);
		} else {
			setProgress('Dekodowanie i optymalizacja GIF w Web Workerze…', 35);
			const startFrame = Math.max(0, (Number.parseInt(gifStartFrame.value, 10) || 1) - 1);
			const endFrame = Math.max(startFrame, (Number.parseInt(gifEndFrame.value, 10) || sourceState.frameCount) - 1);
			const adjustedFps = Math.max(1, Math.min(50, Math.round(baseFps * speed)));
			const bytesCopy = sourceState.bytes.slice().buffer;

			encoded = await callWorker<WorkerEncodedResponse>(
				{
					id: nextRequestId++,
					type: 'reencode',
					bytes: bytesCopy,
					startFrame,
					endFrame,
					targetWidth: width,
					targetHeight: height,
					fps: adjustedFps,
					quality,
					playCount,
					bounce,
				},
				[bytesCopy],
			);
		}

		setProgress('Finalizowanie…', 100);

		const gifBlob = new Blob([encoded.bytes], {type: 'image/gif'});
		resultObjectUrl = URL.createObjectURL(gifBlob);

		const baseName = sourceState.file.name.replace(/\.[^.]+$/, '');
		resultGifImg.src = resultObjectUrl;
		downloadBtn.href = resultObjectUrl;
		downloadBtn.download = `${baseName}.gif`;

		statSize.textContent = formatBytes(gifBlob.size);
		statDimensions.textContent = `${encoded.width} × ${encoded.height}`;
		statFrames.textContent = String(encoded.frameCount);
		statDuration.textContent = formatTime(encoded.durationSeconds);

		resultCard.hidden = false;
		resultCard.scrollIntoView({behavior: 'smooth', block: 'nearest'});
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			showError('Konwersja została anulowana.');
		} else {
			showError(error instanceof Error ? error.message : 'Nie udało się zakodować pliku GIF.');
		}
	} finally {
		activeAbortController = null;
		setBusy(false);
	}
}

modeVideoBtn.addEventListener('click', () => setMode('video'));
modeGifBtn.addEventListener('click', () => setMode('gif'));

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', event => {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		fileInput.click();
	}
});

dropzone.addEventListener('dragover', event => {
	event.preventDefault();
	dropzone.classList.add('is-dragover');
});

dropzone.addEventListener('dragleave', () => {
	dropzone.classList.remove('is-dragover');
});

dropzone.addEventListener('drop', event => {
	event.preventDefault();
	dropzone.classList.remove('is-dragover');
	const file = event.dataTransfer?.files[0];
	if (file) {
		void handleSelectedFile(file);
	}
});

fileInput.addEventListener('change', () => {
	const file = fileInput.files?.[0];
	if (file) {
		void handleSelectedFile(file);
	}

	fileInput.value = '';
});

changeFileBtn.addEventListener('click', () => {
	clearError();
	clearSource();
});

trimStartRange.addEventListener('input', () => {
	const start = Number.parseFloat(trimStartRange.value);
	const end = Number.parseFloat(trimEndRange.value);
	if (start > end) {
		trimEndRange.value = String(start);
	}

	if (Number.isFinite(start)) {
		sourceVideo.currentTime = start;
	}

	updateDerivedUI();
});

trimEndRange.addEventListener('input', () => {
	const start = Number.parseFloat(trimStartRange.value);
	const end = Number.parseFloat(trimEndRange.value);
	if (end < start) {
		trimStartRange.value = String(end);
	}

	if (Number.isFinite(end)) {
		sourceVideo.currentTime = end;
	}

	updateDerivedUI();
});

gifStartFrame.addEventListener('input', () => {
	const start = Number.parseInt(gifStartFrame.value, 10);
	const end = Number.parseInt(gifEndFrame.value, 10);
	if (start > end) {
		gifEndFrame.value = String(start);
	}

	updateDerivedUI();
});

gifEndFrame.addEventListener('input', () => {
	const start = Number.parseInt(gifStartFrame.value, 10);
	const end = Number.parseInt(gifEndFrame.value, 10);
	if (end < start) {
		gifStartFrame.value = String(end);
	}

	updateDerivedUI();
});

for (const button of widthPresetButtons) {
	button.addEventListener('click', () => {
		widthInput.value = button.dataset.width ?? '480';
		updateDerivedUI();
	});
}

widthInput.addEventListener('input', updateDerivedUI);
fpsRange.addEventListener('input', updateDerivedUI);
qualityRange.addEventListener('input', updateDerivedUI);
speedSelect.addEventListener('change', updateDerivedUI);
bounceCheckbox.addEventListener('change', updateDerivedUI);

loopSelect.addEventListener('change', () => {
	customLoopWrap.hidden = loopSelect.value !== 'custom';
});

convertBtn.addEventListener('click', () => {
	void runConversion();
});

cancelBtn.addEventListener('click', () => {
	activeAbortController?.abort();
	resetWorker();
});
