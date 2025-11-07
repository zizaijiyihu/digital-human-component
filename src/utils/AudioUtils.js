/**
 * 音频处理工具函数
 */

/**
 * 将 PCM 原始音频数据转换为 WAV 格式
 * @param {ArrayBuffer|Uint8Array} pcmData - PCM 原始音频数据
 * @param {Object} options - 音频参数
 * @param {number} options.sampleRate - 采样率（默认 16000）
 * @param {number} options.numChannels - 声道数（默认 1，单声道）
 * @param {number} options.bitDepth - 位深度（默认 16）
 * @returns {ArrayBuffer} WAV 格式的音频数据
 */
export function pcmToWav(pcmData, options = {}) {
    const {
        sampleRate = 16000,
        numChannels = 1,
        bitDepth = 16
    } = options;

    // 确保 pcmData 是 Uint8Array
    const pcmBytes = pcmData instanceof Uint8Array ? pcmData : new Uint8Array(pcmData);

    const bytesPerSample = bitDepth / 8;
    const numSamples = pcmBytes.length / bytesPerSample;

    // WAV 文件总大小 = 44 字节头 + PCM 数据大小
    const wavBuffer = new ArrayBuffer(44 + pcmBytes.length);
    const view = new DataView(wavBuffer);

    // 写入 WAV 文件头
    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmBytes.length, true);  // 文件大小 - 8
    writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);                    // fmt chunk size (16 for PCM)
    view.setUint16(20, 1, true);                     // audio format (1 = PCM)
    view.setUint16(22, numChannels, true);           // number of channels
    view.setUint32(24, sampleRate, true);            // sample rate
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);  // byte rate
    view.setUint16(32, numChannels * bytesPerSample, true);  // block align
    view.setUint16(34, bitDepth, true);              // bits per sample

    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, pcmBytes.length, true);       // data size

    // 写入 PCM 数据
    const wavBytes = new Uint8Array(wavBuffer);
    wavBytes.set(pcmBytes, 44);

    return wavBuffer;
}

/**
 * 将字符串写入 DataView
 * @private
 */
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/**
 * 检测音频数据是否为 PCM 格式（没有 WAV 头）
 * @param {ArrayBuffer} audioData - 音频数据
 * @returns {boolean}
 */
export function isPCM(audioData) {
    if (audioData.byteLength < 12) {
        return false;
    }

    const view = new DataView(audioData);

    // 检查是否有 RIFF 标识
    const riff = String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2),
        view.getUint8(3)
    );

    // 如果不是 RIFF，则认为是 PCM
    return riff !== 'RIFF';
}

/**
 * 自动处理音频数据：如果是 PCM 则转换为 WAV
 * @param {ArrayBuffer} audioData - 音频数据
 * @param {Object} options - 音频参数（仅当检测到 PCM 时使用）
 * @returns {ArrayBuffer}
 */
export function processAudioData(audioData, options = {}) {
    if (isPCM(audioData)) {
        console.log('🔄 检测到 PCM 格式，自动转换为 WAV');
        return pcmToWav(audioData, options);
    }
    return audioData;
}

/**
 * 创建音频处理管道，用于流式 PCM 转 WAV
 * 支持逐步接收 PCM 片段并转换为 WAV
 */
export class PCMToWavConverter {
    constructor(options = {}) {
        this.sampleRate = options.sampleRate || 16000;
        this.numChannels = options.numChannels || 1;
        this.bitDepth = options.bitDepth || 16;
    }

    /**
     * 转换单个 PCM 片段为 WAV
     * @param {ArrayBuffer|Uint8Array} pcmChunk - PCM 片段
     * @returns {ArrayBuffer} WAV 格式的音频
     */
    convert(pcmChunk) {
        return pcmToWav(pcmChunk, {
            sampleRate: this.sampleRate,
            numChannels: this.numChannels,
            bitDepth: this.bitDepth
        });
    }

    /**
     * 批量转换 PCM 片段
     * @param {Array<ArrayBuffer>} pcmChunks - PCM 片段数组
     * @returns {Array<ArrayBuffer>} WAV 格式的音频数组
     */
    convertBatch(pcmChunks) {
        return pcmChunks.map(chunk => this.convert(chunk));
    }
}
