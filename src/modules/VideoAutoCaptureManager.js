import { MLVADDetector } from './MLVADDetector.js';
import { CircularVideoBuffer } from './CircularVideoBuffer.js';

/**
 * 视频自动采集管理器（分组录制架构）
 *
 * 核心逻辑：
 * - 循环录制 N 组视频（默认 3 组），每组 M 秒（默认 3 秒）
 * - 说话时：获取说话前的 N 组 + 说话期间的 1 组
 * - 回调返回视频数组（按时间排序）
 */
export class VideoAutoCaptureManager {
    constructor(mediaStream, options = {}) {
        this.mediaStream = mediaStream;

        // 配置参数
        this.config = {
            // 视频录制配置
            maxGroups: options.maxGroups || 1,                    // 保留的视频组数量（默认 1 组）
            groupDuration: options.groupDuration || 5000,         // 每组视频时长（默认 5000ms = 5 秒）
            maxRecordDuration: options.maxRecordDuration || 300000, // 最大录制时长（5 分钟）
            videoFormat: options.videoFormat || 'video/webm',
            videoBitsPerSecond: options.videoBitsPerSecond || 2500000,
            includeBeforeSpeaking: options.includeBeforeSpeaking !== false,  // 是否包含说话前的视频（默认 true）

            // VAD 配置（使用 ML-based VAD）
            silenceDuration: options.silenceDuration || 2000,     // 静音持续时间（默认 2000ms）
            minSpeakDuration: options.minSpeakDuration || 900     // 最小说话时长（默认 900ms）
        };

        // 回调函数
        this.onVideoCapture = options.onVideoCapture || null;
        this.onSpeakingStart = options.onSpeakingStart || null;
        this.onSpeakingEnd = options.onSpeakingEnd || null;
        this.onError = options.onError || null;

        // 状态
        this.isRunning = false;
        this.isRecording = false;

        // 核心组件
        this.circularBuffer = null;      // 循环缓冲区（管理 N 组视频）
        this.mediaRecorder = null;       // 唯一的 MediaRecorder
        this.speechDetector = null;      // 说话检测器（ML VAD）

        // 定期重启定时器
        this.restartTimer = null;

        // 说话录制
        this.speakingRecorder = null;    // 说话期间的录制器
        this.speakingChunks = [];        // 说话期间的 chunks
        this.speakingStartTime = null;
        this.speakingTimeout = null;
        this.snapshotGroups = null;      // 说话开始时的视频组快照
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
            this.circularBuffer = new CircularVideoBuffer(this.config.maxGroups);

            // 2. 初始化说话检测器（ML VAD）
            await this._initSpeechDetector();

            // 3. 初始化 MediaRecorder
            this._initMediaRecorder();

            // 4. 启动循环录制
            this._startRecording();

            this.isRunning = true;
            console.log(`✅ VideoAutoCaptureManager started (${this.config.maxGroups} groups × ${this.config.groupDuration}ms)`);

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

        // 停止定期重启定时器
        if (this.restartTimer) {
            clearInterval(this.restartTimer);
            this.restartTimer = null;
        }

        // 停止说话检测
        if (this.speechDetector) {
            this.speechDetector.stop();
        }

        // 停止 MediaRecorder
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }

        // 停止说话录制器
        if (this.speakingRecorder && this.speakingRecorder.state === 'recording') {
            this.speakingRecorder.stop();
        }

        // 清理缓冲区
        if (this.circularBuffer) {
            this.circularBuffer.clear();
        }

        this.isRunning = false;
        this.isRecording = false;

        console.log('⏹ VideoAutoCaptureManager stopped');
    }

    /**
     * 初始化说话检测器（使用 ML-based VAD）
     * @private
     */
    _initSpeechDetector() {
        console.log('[VAD] Using ML-based VAD (@ricky0123/vad-web)');

        // 使用 ML-based VAD
        this.speechDetector = new MLVADDetector(this.mediaStream, {
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

        if (!MediaRecorder.isTypeSupported(mimeType)) {
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
        }

        // 创建 MediaRecorder
        this.mediaRecorder = new MediaRecorder(this.mediaStream, {
            mimeType: mimeType,
            videoBitsPerSecond: this.config.videoBitsPerSecond
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0 && this.circularBuffer) {
                this.circularBuffer.add(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            console.log('[Recorder] Stopped');
        };

        this.mediaRecorder.onerror = (event) => {
            console.error('[Recorder] Error:', event);
            if (this.onError) {
                this.onError(event.error);
            }
        };

        console.log(`[VideoCapture] MediaRecorder created with mimeType: ${mimeType}`);
    }

    /**
     * 启动循环录制
     * @private
     */
    _startRecording() {
        console.log(`[VideoCapture] Starting recording (${this.config.groupDuration}ms per group)`);

        // 启动新的录制组
        const timestamp = Date.now();
        this.circularBuffer.startNewGroup(timestamp);

        // 开始录制
        this.mediaRecorder.start(100); // 每 100ms 产生一个 chunk
        console.log('[Recorder] Started');

        // 定期重启 MediaRecorder（每组录制完成后重启）
        this.restartTimer = setInterval(() => {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                console.log(`[VideoCapture] Restarting recorder (every ${this.config.groupDuration}ms)`);

                // 停止当前录制
                this.mediaRecorder.stop();

                // 等待一小段时间后重启
                setTimeout(() => {
                    if (this.isRunning && this.mediaRecorder) {
                        // 启动新的录制组
                        const timestamp = Date.now();
                        this.circularBuffer.startNewGroup(timestamp);

                        // 重新开始录制
                        this.mediaRecorder.start(100);
                    }
                }, 50);
            }
        }, this.config.groupDuration);

        // 启动说话检测
        this.speechDetector.start(100);

        console.log(`[Recorder] Auto-restart enabled (interval: ${this.config.groupDuration}ms)`);
    }

    /**
     * 处理说话开始
     * @private
     */
    _handleSpeakingStart() {
        console.log('🗣️ Speaking started');

        // 1. 快照当前所有视频组（说话前的 N 组），包括正在录制的组
        this.snapshotGroups = this.circularBuffer.getAllGroups();

        // 添加当前正在录制的组（如果有）
        const currentGroup = this.circularBuffer.getCurrentGroup();
        if (currentGroup) {
            this.snapshotGroups.push(currentGroup);
            console.log(`📦 Snapshot ${this.snapshotGroups.length} groups before speaking (${this.snapshotGroups.length - 1} completed + 1 recording)`);
        } else {
            console.log(`📦 Snapshot ${this.snapshotGroups.length} groups before speaking (all completed)`);
        }

        // 2. 触发用户回调
        if (this.onSpeakingStart) {
            this.onSpeakingStart();
        }

        // 3. 开始录制说话期间的视频
        this.isRecording = true;
        this.speakingStartTime = Date.now();
        this.speakingChunks = [];

        // 创建说话录制器
        this.speakingRecorder = new MediaRecorder(this.mediaStream, {
            mimeType: this.mediaRecorder.mimeType,
            videoBitsPerSecond: this.config.videoBitsPerSecond
        });

        this.speakingRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                this.speakingChunks.push(event.data);
            }
        };

        this.speakingRecorder.start(100);
        console.log('[SpeakingRecorder] Started');

        // 4. 设置最大录制时长限制
        this.speakingTimeout = setTimeout(() => {
            console.warn('⚠️ Max speaking duration reached, forcing stop');
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
        if (this.speakingTimeout) {
            clearTimeout(this.speakingTimeout);
            this.speakingTimeout = null;
        }

        // 停止说话录制器
        if (this.speakingRecorder && this.speakingRecorder.state === 'recording') {
            this.speakingRecorder.stop();
        }

        this.isRecording = false;

        // 等待最后的数据
        setTimeout(() => {
            // 计算说话时长
            const duration = Date.now() - this.speakingStartTime;

            // 合并说话期间的视频
            const speakingBlob = new Blob(this.speakingChunks, { type: this.config.videoFormat });

            console.log(`📹 Speaking video: ${(duration / 1000).toFixed(1)}s, ${(speakingBlob.size / 1024 / 1024).toFixed(2)} MB, ${this.speakingChunks.length} chunks`);

            // 注意：说话时长验证已在 SpeechDetector 中完成
            // 只有有效的说话（≥ minSpeakDuration）才会触发此回调

            // 构建视频组数组（说话前的 N 组 + 说话期间的 1 组）
            const videoGroups = [];

            // 添加说话前的 N 组（如果启用）
            if (this.config.includeBeforeSpeaking && this.snapshotGroups && Array.isArray(this.snapshotGroups)) {
                for (const group of this.snapshotGroups) {
                    videoGroups.push({
                        blob: group.blob,
                        duration: group.duration,
                        startTime: group.startTime,
                        endTime: group.endTime,
                        size: group.size,
                        type: 'before-speaking'
                    });
                }
            }

            // 添加说话期间的 1 组
            videoGroups.push({
                blob: speakingBlob,
                duration: duration,
                startTime: this.speakingStartTime,
                endTime: Date.now(),
                size: speakingBlob.size,
                type: 'speaking'
            });

            const beforeCount = this.config.includeBeforeSpeaking ? (this.snapshotGroups?.length || 0) : 0;
            console.log(`✅ Total video groups: ${videoGroups.length} (${beforeCount} before + 1 speaking)`);

            // 打印详细的视频组信息
            console.log('📹 Video groups details:');
            videoGroups.forEach((group, index) => {
                console.log(`  [${index + 1}] ${group.type}:`, {
                    duration: `${(group.duration / 1000).toFixed(1)}s`,
                    size: `${(group.size / 1024 / 1024).toFixed(2)} MB`,
                    startTime: new Date(group.startTime).toISOString(),
                    endTime: new Date(group.endTime).toISOString()
                });
            });

            // 触发视频捕获回调
            if (this.onVideoCapture) {
                this.onVideoCapture(videoGroups);
            }

            // 🆕 清空已捕获的视频组，防止下次说话时重复捕获
            // 清空缓冲区中的所有旧视频组
            if (this.circularBuffer) {
                this.circularBuffer.clear();
                // 立即启动新的录制组，因为主 MediaRecorder 仍在运行
                this.circularBuffer.startNewGroup(Date.now());
                console.log('🗑️ Cleared captured video groups and started new group');
            }

            // 清理临时数据
            this.snapshotGroups = null;
            this.speakingChunks = [];
            this.speakingStartTime = null;
            this.speakingRecorder = null;

        }, 200);
    }

    /**
     * 获取当前状态
     * @returns {Object}
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isRecording: this.isRecording,
            groupCount: this.circularBuffer ? this.circularBuffer.getGroupCount() : 0,
            currentEnergy: this.speechDetector ? this.speechDetector.getCurrentEnergy() : 0,
            threshold: this.config.speechThreshold,
            isSpeaking: this.speechDetector ? this.speechDetector.getSpeakingState() : false
        };
    }

    /**
     * 获取所有视频组（随时调用）
     * @returns {Array} 视频组数组
     */
    getAllVideoGroups() {
        if (!this.circularBuffer) {
            return [];
        }

        const groups = this.circularBuffer.getAllGroups();

        // 可选：包含当前正在录制的组
        const currentGroup = this.circularBuffer.getCurrentGroup();
        if (currentGroup) {
            groups.push(currentGroup);
        }

        return groups;
    }

    /**
     * 销毁管理器
     */
    destroy() {
        this.stop();

        this.circularBuffer = null;
        this.speechDetector = null;
        this.mediaRecorder = null;
        this.speakingRecorder = null;
        this.audioAnalyser = null;
        this.audioContext = null;

        this.onVideoCapture = null;
        this.onSpeakingStart = null;
        this.onSpeakingEnd = null;
        this.onError = null;

        console.log('🗑️ VideoAutoCaptureManager destroyed');
    }
}
