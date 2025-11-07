import { processAudioData } from '../utils/AudioUtils.js';

/**
 * 音频流队列管理器
 * 用于处理流式音频片段的无缝播放
 */
export class AudioStreamQueue {
    constructor(audioContext, analyser, options = {}) {
        this.audioContext = audioContext;
        this.analyser = analyser;

        // 播放队列
        this.queue = [];
        this.isPlaying = false;
        this.isStopped = false;

        // 时间管理
        this.nextStartTime = 0;
        this.activeSources = [];  // 改为数组，支持多个并发音频源

        // 事件回调
        this.onStart = null;
        this.onEnd = null;
        this.onError = null;

        // 配置
        this.config = {
            // 预加载阈值：当队列中音频少于此时长(秒)时触发 onNeedData
            bufferThreshold: 0.5,
            // 最大队列长度(秒)，防止内存溢出
            maxQueueDuration: 10,
            // 自动 PCM 转换（如果检测到 PCM 格式）
            autoPCMConvert: options.autoPCMConvert !== false,
            // PCM 音频参数（仅在自动转换时使用）
            pcmOptions: {
                sampleRate: options.sampleRate || 16000,
                numChannels: options.numChannels || 1,
                bitDepth: options.bitDepth || 16
            }
        };

        this.onNeedData = null;
    }

    /**
     * 添加音频片段到队列
     * @param {ArrayBuffer} audioData - 音频数据（支持 PCM 或 WAV 格式）
     * @returns {Promise<void>}
     */
    async enqueue(audioData) {
        if (this.isStopped) {
            return;
        }

        try {
            // 自动处理音频数据（如果是 PCM 则转换为 WAV）
            let processedData = audioData;
            if (this.config.autoPCMConvert) {
                processedData = processAudioData(audioData, this.config.pcmOptions);
            }

            // 解码音频数据
            const audioBuffer = await this.audioContext.decodeAudioData(processedData);

            // 检查队列长度
            const queueDuration = this._getQueueDuration();
            if (queueDuration > this.config.maxQueueDuration) {
                console.warn('AudioStreamQueue: Queue is full, skipping chunk');
                return;
            }

            // 添加到队列
            this.queue.push(audioBuffer);

            // 如果还没开始播放，启动播放
            if (!this.isPlaying) {
                this._startPlayback();
            } else {
                // 如果正在播放，调度下一个片段
                this._scheduleNext();
            }

        } catch (error) {
            console.error('AudioStreamQueue: Failed to decode audio data:', error);
            if (this.onError) {
                this.onError(error);
            }
        }
    }

    /**
     * 标记流结束（不再有新数据）
     */
    finalize() {
        // 标记为完成，但继续播放队列中的剩余音频
        this.isFinalized = true;
    }

    /**
     * 停止播放并清空队列
     */
    stop() {
        this.isStopped = true;
        this.isPlaying = false;

        // 停止所有活跃的音频源
        this.activeSources.forEach(source => {
            try {
                source.stop();
            } catch (e) {
                // 可能已经停止
            }
        });
        this.activeSources = [];

        // 清空队列
        this.queue = [];
        this.nextStartTime = 0;
    }

    /**
     * 获取队列中的总时长
     * @private
     */
    _getQueueDuration() {
        return this.queue.reduce((total, buffer) => total + buffer.duration, 0);
    }

    /**
     * 开始播放
     * @private
     */
    _startPlayback() {
        if (this.isPlaying || this.queue.length === 0) {
            return;
        }

        this.isPlaying = true;

        // 初始化时间
        this.nextStartTime = this.audioContext.currentTime;

        // 触发开始回调
        if (this.onStart) {
            this.onStart();
        }

        // 播放第一个片段
        this._playNext();
    }

    /**
     * 播放下一个音频片段
     * @private
     */
    _playNext() {
        if (this.isStopped || this.queue.length === 0) {
            // 如果队列为空且已经 finalized，并且没有活跃的音频源，触发结束回调
            if (this.isFinalized && this.queue.length === 0 && this.activeSources.length === 0) {
                this.isPlaying = false;
                if (this.onEnd) {
                    this.onEnd();
                }
            }
            return;
        }

        const audioBuffer = this.queue.shift();

        // 创建音频源
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;

        // 连接到分析器
        source.connect(this.analyser);

        // 设置结束回调
        source.onended = () => {
            // 从活跃列表中移除
            const index = this.activeSources.indexOf(source);
            if (index > -1) {
                this.activeSources.splice(index, 1);
            }

            // 检查是否需要更多数据
            const queueDuration = this._getQueueDuration();
            if (queueDuration < this.config.bufferThreshold && this.onNeedData && !this.isFinalized) {
                this.onNeedData();
            }

            // 检查是否所有音频都已播放完成
            if (this.isFinalized && this.queue.length === 0 && this.activeSources.length === 0) {
                this.isPlaying = false;
                if (this.onEnd) {
                    this.onEnd();
                }
            }
        };

        // 计算开始时间
        const startTime = Math.max(this.nextStartTime, this.audioContext.currentTime);

        // 开始播放
        source.start(startTime);
        this.activeSources.push(source);

        // 更新下一个开始时间
        this.nextStartTime = startTime + audioBuffer.duration;

        // 立即尝试播放下一个片段（允许多个片段并发调度）
        if (this.queue.length > 0) {
            this._playNext();
        }
    }

    /**
     * 调度下一个片段（如果队列中有）
     * @private
     */
    _scheduleNext() {
        // 移除了 !this.currentSource 检查，允许多个片段并发调度
        if (this.queue.length > 0) {
            this._playNext();
        }
    }

    /**
     * 销毁队列
     */
    destroy() {
        this.stop();
        this.onStart = null;
        this.onEnd = null;
        this.onError = null;
        this.onNeedData = null;
    }
}
