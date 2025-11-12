/**
 * 基于机器学习的语音活动检测器
 * 使用 @ricky0123/vad-web 库
 *
 * 优势：
 * - 基于深度学习模型，更准确
 * - 不受环境噪音影响
 * - 不需要手动校准阈值
 */
export class MLVADDetector {
    constructor(mediaStream, options = {}) {
        this.mediaStream = mediaStream;

        // 配置参数
        this.silenceDuration = options.silenceDuration || 2000;      // 静音持续时间
        this.minSpeakDuration = options.minSpeakDuration || 900;     // 最小说话时长

        // 状态
        this.isRunning = false;
        this.isSpeaking = false;
        this.speechStartTime = 0;
        this.silenceStartTime = 0;

        // 回调函数
        this.onSpeakingStart = null;
        this.onSpeakingEnd = null;

        // VAD 实例
        this.vad = null;
    }

    /**
     * 启动检测
     */
    async start() {
        if (this.isRunning) {
            console.warn('[MLVAD] Already running');
            return;
        }

        try {
            console.log('[MLVAD] Loading VAD model...');

            // 动态导入 vad-web（通过 CDN）
            const { MicVAD } = await this._loadVADLibrary();

            console.log('[MLVAD] Creating VAD instance...');

            // 创建 VAD 实例
            this.vad = await MicVAD.new({
                stream: this.mediaStream,

                // CDN 路径配置（使用 1.22.0 版本，包含 .mjs 文件）
                onnxWASMBasePath: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',
                baseAssetPath: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/',
                workletURL: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/vad.worklet.bundle.min.js',
                modelURL: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/silero_vad_legacy.onnx',

                // 说话开始回调
                onSpeechStart: () => {
                    console.log('[MLVAD] 🗣️ Speech start detected');
                    this._handleSpeechStart();
                },

                // 说话结束回调
                onSpeechEnd: () => {
                    console.log('[MLVAD] 🔇 Speech end detected');
                    this._handleSpeechEnd();
                },

                // VAD 误判率（0-1，越小越严格）
                positiveSpeechThreshold: 0.8,  // 说话确认阈值
                negativeSpeechThreshold: 0.5,  // 非说话确认阈值

                // 最小说话帧数
                redemptionFrames: 8,

                // 预说话填充帧数
                preSpeechPadFrames: 1,

                // 调试模式
                submitUserSpeechOnPause: false
            });

            this.vad.start();
            this.isRunning = true;

            console.log('[MLVAD] ✅ VAD started successfully');

        } catch (error) {
            console.error('[MLVAD] Failed to start:', error);
            throw error;
        }
    }

    /**
     * 停止检测
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        if (this.vad) {
            this.vad.pause();
            this.vad = null;
        }

        // 如果正在说话，触发结束事件
        if (this.isSpeaking && this.onSpeakingEnd) {
            this.onSpeakingEnd();
        }

        this.isRunning = false;
        this.isSpeaking = false;

        console.log('[MLVAD] ⏹ Stopped');
    }

    /**
     * 处理说话开始
     * @private
     */
    _handleSpeechStart() {
        if (this.isSpeaking) {
            return;
        }

        this.isSpeaking = true;
        this.speechStartTime = Date.now();
        this.silenceStartTime = 0;

        console.log('[MLVAD] 🟢 Speaking started');

        if (this.onSpeakingStart) {
            this.onSpeakingStart();
        }
    }

    /**
     * 处理说话结束
     * @private
     */
    _handleSpeechEnd() {
        if (!this.isSpeaking) {
            return;
        }

        const speakDuration = Date.now() - this.speechStartTime;

        // 验证说话时长
        if (speakDuration < this.minSpeakDuration) {
            console.log(`[MLVAD] ⚠️ Speech too short (${speakDuration}ms < ${this.minSpeakDuration}ms), ignored`);
            this.isSpeaking = false;
            this.speechStartTime = 0;
            return;
        }

        this.isSpeaking = false;
        this.speechStartTime = 0;

        console.log(`[MLVAD] ⏹️ Speaking ended (duration: ${(speakDuration / 1000).toFixed(1)}s)`);

        if (this.onSpeakingEnd) {
            this.onSpeakingEnd();
        }
    }

    /**
     * 动态加载 VAD 库
     * @private
     */
    async _loadVADLibrary() {
        // 检查是否已加载
        if (window.vad) {
            return window.vad;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/bundle.min.js';
            script.onload = () => {
                if (window.vad) {
                    console.log('[MLVAD] Library loaded from CDN');
                    resolve(window.vad);
                } else {
                    reject(new Error('VAD library loaded but not found in window'));
                }
            };
            script.onerror = () => {
                reject(new Error('Failed to load VAD library from CDN'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * 获取当前是否在说话
     */
    getSpeakingState() {
        return this.isSpeaking;
    }

    /**
     * 获取当前音频能量（兼容接口，ML VAD 不提供能量值）
     * @returns {number} 返回 0（ML VAD 不基于能量检测）
     */
    getCurrentEnergy() {
        return 0;
    }

    /**
     * 获取低阈值（兼容接口，ML VAD 不使用阈值）
     * @returns {number} 返回 0
     */
    getLowThreshold() {
        return 0;
    }

    /**
     * 获取高阈值（兼容接口，ML VAD 不使用阈值）
     * @returns {number} 返回 0
     */
    getHighThreshold() {
        return 0;
    }

    /**
     * 获取当前状态（兼容接口）
     * @returns {string} 'IDLE' 或 'SPEAKING'
     */
    getCurrentState() {
        return this.isSpeaking ? 'SPEAKING' : 'IDLE';
    }

    /**
     * 销毁检测器
     */
    destroy() {
        this.stop();
        this.onSpeakingStart = null;
        this.onSpeakingEnd = null;
        this.mediaStream = null;
    }
}
