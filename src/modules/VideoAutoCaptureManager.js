import { SpeechDetector } from './SpeechDetector.js';
import { CircularVideoBuffer } from './CircularVideoBuffer.js';

/**
 * 视频自动采集管理器
 * 自动采集【最近5秒 + 检测到说话期间】的视频
 */
export class VideoAutoCaptureManager {
    constructor(mediaStream, options = {}) {
        this.mediaStream = mediaStream;

        // 配置参数
        this.config = {
            bufferDuration: options.bufferDuration || 5000,           // 缓冲区时长（默认 5000ms）
            speechThreshold: options.speechThreshold || 40,           // 说话检测阈值（默认 40）
            silenceDuration: options.silenceDuration || 2000,         // 静音持续时间（默认 2000ms）
            minSpeakDuration: options.minSpeakDuration || 500,        // 最小说话时长（默认 500ms）
            maxRecordDuration: options.maxRecordDuration || 300000,   // 最大录制时长（默认 5 分钟）
            videoFormat: options.videoFormat || 'video/webm',         // 视频格式（默认 webm）
            videoBitsPerSecond: options.videoBitsPerSecond || 2500000 // 视频比特率（默认 2.5 Mbps）
        };

        // 回调函数
        this.onVideoCapture = options.onVideoCapture || null;
        this.onSpeakingStart = options.onSpeakingStart || null;
        this.onSpeakingEnd = options.onSpeakingEnd || null;
        this.onError = options.onError || null;

        // 状态
        this.isRunning = false;
        this.isRecording = false;

        // 模块
        this.mediaRecorder = null;
        this.circularBuffer = null;
        this.speechDetector = null;
        this.audioContext = null;
        this.audioAnalyser = null;

        // 录制数据
        this.recordingChunks = [];
        this.recordingStartTime = null;
        this.recordingTimeout = null;
    }

    /**
     * 启动视频自动采集
     */
    async start() {
        if (this.isRunning) {
            console.warn('VideoAutoCaptureManager already running');
            return;
        }

        try {
            // 1. 初始化循环缓冲区
            this.circularBuffer = new CircularVideoBuffer(this.config.bufferDuration);

            // 2. 初始化音频分析器
            this._initAudioAnalyser();

            // 3. 初始化说话检测器
            this._initSpeechDetector();

            // 4. 初始化 MediaRecorder
            this._initMediaRecorder();

            // 5. 启动录制和检测
            console.log('[VideoCapture] Starting MediaRecorder with 100ms timeslice...');
            this.mediaRecorder.start(100); // 每 100ms 产生一个数据块
            console.log('[VideoCapture] MediaRecorder state:', this.mediaRecorder.state);

            this.speechDetector.start(100); // 每 100ms 检测一次

            this.isRunning = true;

            console.log('✅ VideoAutoCaptureManager started');

        } catch (error) {
            console.error('Failed to start VideoAutoCaptureManager:', error);
            if (this.onError) {
                this.onError(error);
            }
            throw error;
        }
    }

    /**
     * 停止视频自动采集
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        // 停止说话检测
        if (this.speechDetector) {
            this.speechDetector.stop();
        }

        // 停止 MediaRecorder
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        // 清理录制超时
        if (this.recordingTimeout) {
            clearTimeout(this.recordingTimeout);
            this.recordingTimeout = null;
        }

        // 清空缓冲区
        if (this.circularBuffer) {
            this.circularBuffer.clear();
        }

        // 关闭音频上下文
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }

        this.isRunning = false;
        this.isRecording = false;

        console.log('⏹ VideoAutoCaptureManager stopped');
    }

    /**
     * 初始化音频分析器
     * @private
     */
    _initAudioAnalyser() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioAnalyser = this.audioContext.createAnalyser();
        this.audioAnalyser.fftSize = 2048;
        this.audioAnalyser.smoothingTimeConstant = 0.8;

        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        source.connect(this.audioAnalyser);
    }

    /**
     * 初始化说话检测器
     * @private
     */
    _initSpeechDetector() {
        this.speechDetector = new SpeechDetector(this.audioAnalyser, {
            threshold: this.config.speechThreshold,
            silenceDuration: this.config.silenceDuration,
            minSpeakDuration: this.config.minSpeakDuration
        });

        // 说话开始事件
        this.speechDetector.onSpeakingStart = () => {
            this._handleSpeakingStart();
        };

        // 说话结束事件
        this.speechDetector.onSpeakingEnd = () => {
            this._handleSpeakingEnd();
        };
    }

    /**
     * 初始化 MediaRecorder
     * @private
     */
    _initMediaRecorder() {
        // 检查 MIME 类型支持
        let mimeType = this.config.videoFormat;
        console.log(`[VideoCapture] Requested MIME type: ${mimeType}`);

        if (!MediaRecorder.isTypeSupported(mimeType)) {
            console.warn(`[VideoCapture] ${mimeType} not supported, trying fallback formats`);

            // 尝试备选格式
            const fallbacks = [
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm'
            ];

            for (const format of fallbacks) {
                if (MediaRecorder.isTypeSupported(format)) {
                    mimeType = format;
                    console.log(`[VideoCapture] Using fallback format: ${format}`);
                    break;
                }
            }
        } else {
            console.log(`[VideoCapture] Using supported format: ${mimeType}`);
        }

        this.mediaRecorder = new MediaRecorder(this.mediaStream, {
            mimeType: mimeType,
            videoBitsPerSecond: this.config.videoBitsPerSecond
        });

        console.log(`[VideoCapture] MediaRecorder created with mimeType: ${this.mediaRecorder.mimeType}`);

        // 数据可用事件
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                const timestamp = Date.now();

                if (this.isRecording) {
                    // 正在录制，保存到录制缓冲区
                    this.recordingChunks.push(event.data);
                    console.log(`[Recording] Added chunk ${this.recordingChunks.length}, size: ${event.data.size} bytes`);
                } else if (this.circularBuffer) {
                    // 循环缓冲区模式（检查缓冲区是否存在）
                    this.circularBuffer.add(event.data, timestamp);
                    console.log(`[Buffer] Added chunk, buffer size: ${this.circularBuffer.getChunkCount()}, duration: ${this.circularBuffer.getDuration()}ms`);
                }
            } else {
                console.warn('[VideoCapture] ondataavailable fired but data is empty or zero size');
            }
        };

        // 停止事件
        this.mediaRecorder.onstop = () => {
            console.log('MediaRecorder stopped');
        };

        // 错误事件
        this.mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event);
            if (this.onError) {
                this.onError(event.error);
            }
        };
    }

    /**
     * 处理说话开始
     * @private
     */
    _handleSpeakingStart() {
        console.log('🗣️ Speaking started');

        // 触发用户回调
        if (this.onSpeakingStart) {
            this.onSpeakingStart();
        }

        // 开始录制
        this.isRecording = true;
        this.recordingStartTime = Date.now();
        this.recordingChunks = [];

        // 将循环缓冲区的内容添加到录制缓冲区
        const bufferedChunks = this.circularBuffer.getAll();
        this.recordingChunks.push(...bufferedChunks);

        console.log(`📹 Recording started with ${bufferedChunks.length} buffered chunks (${this.circularBuffer.getDuration()}ms)`);

        // 设置最大录制时长限制
        this.recordingTimeout = setTimeout(() => {
            console.warn('⚠️ Max recording duration reached, forcing stop');
            this._handleSpeakingEnd();
        }, this.config.maxRecordDuration);
    }

    /**
     * 处理说话结束
     * @private
     */
    _handleSpeakingEnd() {
        if (!this.isRecording) {
            return;
        }

        console.log('🔇 Speaking ended');

        // 触发用户回调
        if (this.onSpeakingEnd) {
            this.onSpeakingEnd();
        }

        // 清理录制超时
        if (this.recordingTimeout) {
            clearTimeout(this.recordingTimeout);
            this.recordingTimeout = null;
        }

        // 停止录制
        this.isRecording = false;

        // 计算录制时长
        const duration = Date.now() - this.recordingStartTime;

        // 合并视频片段
        const videoBlob = new Blob(this.recordingChunks, { type: this.config.videoFormat });

        console.log(`📹 Recording finished: ${this.recordingChunks.length} chunks, ${duration}ms, ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);

        // 生成元数据
        const metadata = {
            duration: duration,
            startTime: this.recordingStartTime,
            endTime: Date.now(),
            size: videoBlob.size,
            chunkCount: this.recordingChunks.length,
            format: this.config.videoFormat
        };

        // 触发视频捕获回调
        if (this.onVideoCapture) {
            this.onVideoCapture(videoBlob, metadata);
        }

        // 清空录制缓冲区
        this.recordingChunks = [];
        this.recordingStartTime = null;
    }

    /**
     * 获取当前状态
     * @returns {Object}
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isRecording: this.isRecording,
            bufferDuration: this.circularBuffer ? this.circularBuffer.getDuration() : 0,
            bufferChunks: this.circularBuffer ? this.circularBuffer.getChunkCount() : 0,
            bufferSize: this.circularBuffer ? this.circularBuffer.getTotalSize() : 0,
            recordingDuration: this.isRecording ? Date.now() - this.recordingStartTime : 0,
            recordingChunks: this.recordingChunks.length,
            currentEnergy: this.speechDetector ? this.speechDetector.getCurrentEnergy() : 0,
            threshold: this.config.speechThreshold,
            isSpeaking: this.speechDetector ? this.speechDetector.getSpeakingState() : false
        };
    }

    /**
     * 获取当前缓冲区的视频（最近5秒）
     * @returns {Object|null} { blob: Blob, metadata: Object } 或 null
     */
    getCurrentBufferVideo() {
        if (!this.circularBuffer || this.circularBuffer.getChunkCount() === 0) {
            console.warn('[VideoCapture] Cannot get buffer video: buffer is empty or null');
            return null;
        }

        const chunks = this.circularBuffer.getAll();

        // 详细诊断
        console.log(`[VideoCapture] Getting buffer video:`);
        console.log(`  - Total chunks: ${chunks.length}`);
        console.log(`  - First chunk size: ${chunks[0]?.size || 0} bytes (should be init segment)`);
        console.log(`  - Chunk sizes:`, chunks.map(c => c.size));
        console.log(`  - Using mimeType: ${this.config.videoFormat}`);

        const videoBlob = new Blob(chunks, { type: this.config.videoFormat });

        const metadata = {
            duration: this.circularBuffer.getDuration(),
            size: videoBlob.size,
            chunkCount: chunks.length,
            format: this.config.videoFormat,
            type: 'buffer' // 标记这是缓冲区视频
        };

        console.log(`📹 Current buffer video: ${chunks.length} chunks, ${metadata.duration}ms, ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);

        return { blob: videoBlob, metadata };
    }

    /**
     * 销毁管理器
     */
    destroy() {
        this.stop();

        this.circularBuffer = null;
        this.speechDetector = null;
        this.mediaRecorder = null;
        this.audioAnalyser = null;
        this.audioContext = null;

        this.onVideoCapture = null;
        this.onSpeakingStart = null;
        this.onSpeakingEnd = null;
        this.onError = null;

        console.log('🗑️ VideoAutoCaptureManager destroyed');
    }
}
