/**
 * 说话检测器
 * 基于音频能量分析检测用户是否在说话
 */
export class SpeechDetector {
    constructor(analyser, options = {}) {
        this.analyser = analyser;

        // 配置参数
        this.threshold = options.threshold || 40;                    // 能量阈值（默认 40）
        this.silenceDuration = options.silenceDuration || 2000;      // 静音持续时间（默认 2000ms）
        this.minSpeakDuration = options.minSpeakDuration || 500;     // 最小说话时长（默认 500ms）

        // 状态
        this.isSpeaking = false;
        this.lastSpeechTime = 0;
        this.speechStartTime = 0;
        this.silenceStartTime = 0;

        // 回调函数
        this.onSpeakingStart = null;
        this.onSpeakingEnd = null;

        // 检测循环
        this.detectionInterval = null;
        this.isRunning = false;

        // 数据缓冲
        this.dataArray = new Uint8Array(analyser.frequencyBinCount);
    }

    /**
     * 启动说话检测
     * @param {number} interval - 检测间隔（毫秒）
     */
    start(interval = 100) {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        this.isSpeaking = false;
        this.lastSpeechTime = 0;
        this.speechStartTime = 0;
        this.silenceStartTime = 0;

        this.detectionInterval = setInterval(() => {
            this._detect();
        }, interval);

        console.log('✅ SpeechDetector started');
    }

    /**
     * 停止说话检测
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;

        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }

        // 如果正在说话，触发结束事件
        if (this.isSpeaking && this.onSpeakingEnd) {
            this.onSpeakingEnd();
        }

        this.isSpeaking = false;

        console.log('⏹ SpeechDetector stopped');
    }

    /**
     * 执行检测
     * @private
     */
    _detect() {
        const now = Date.now();
        const energy = this._getAudioEnergy();
        const isCurrentlySpeaking = energy > this.threshold;

        if (isCurrentlySpeaking) {
            // 检测到声音
            this.lastSpeechTime = now;

            if (!this.isSpeaking) {
                // 从静音到说话
                if (this.speechStartTime === 0) {
                    this.speechStartTime = now;
                }

                // 持续说话超过最小时长，触发开始事件
                const speakDuration = now - this.speechStartTime;
                if (speakDuration >= this.minSpeakDuration) {
                    this.isSpeaking = true;
                    this.silenceStartTime = 0;

                    if (this.onSpeakingStart) {
                        this.onSpeakingStart();
                    }
                }
            }
        } else {
            // 检测到静音
            if (this.isSpeaking) {
                // 从说话到静音
                if (this.silenceStartTime === 0) {
                    this.silenceStartTime = now;
                }

                // 持续静音超过阈值，触发结束事件
                const silenceDuration = now - this.silenceStartTime;
                if (silenceDuration >= this.silenceDuration) {
                    this.isSpeaking = false;
                    this.speechStartTime = 0;
                    this.silenceStartTime = 0;

                    if (this.onSpeakingEnd) {
                        this.onSpeakingEnd();
                    }
                }
            } else {
                // 持续静音，重置说话开始时间
                this.speechStartTime = 0;
            }
        }
    }

    /**
     * 获取音频能量
     * @private
     * @returns {number} 平均音频能量 (0-255)
     */
    _getAudioEnergy() {
        this.analyser.getByteFrequencyData(this.dataArray);

        // 计算平均能量
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }

        return sum / this.dataArray.length;
    }

    /**
     * 获取当前是否在说话
     * @returns {boolean}
     */
    getSpeakingState() {
        return this.isSpeaking;
    }

    /**
     * 设置阈值
     * @param {number} threshold - 新的能量阈值
     */
    setThreshold(threshold) {
        this.threshold = threshold;
    }

    /**
     * 销毁检测器
     */
    destroy() {
        this.stop();
        this.onSpeakingStart = null;
        this.onSpeakingEnd = null;
        this.dataArray = null;
    }
}
