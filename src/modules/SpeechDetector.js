/**
 * 说话检测器（动态自适应阈值 + 预激活机制）
 * 基于音频能量分析检测用户是否在说话
 *
 * 核心特性：
 * 1. 动态自适应阈值：根据环境噪音自动调整阈值
 * 2. 预激活机制：低能量也能触发预激活，持续上升则确认为说话
 * 3. 三状态机：IDLE → PRE_ACTIVE → SPEAKING
 */
export class SpeechDetector {
    constructor(analyser, options = {}) {
        this.analyser = analyser;

        // 配置参数
        this.baseThreshold = options.threshold || 30;                // 基础阈值（仅用于未校准时）
        this.silenceDuration = options.silenceDuration || 2000;      // 静音持续时间（默认 2000ms）
        this.minSpeakDuration = options.minSpeakDuration || 900;     // 最小说话时长（默认 900ms）
        this.calibrationDuration = options.calibrationDuration || 3000;  // 校准时长（默认 3000ms）
        this.noiseUpdateInterval = options.noiseUpdateInterval || 10000; // 噪音基准更新间隔（默认 10s）

        // 动态阈值参数
        this.noiseBaseline = null;              // 背景噪音基准
        this.noiseHistory = [];                 // 噪音历史（用于计算基准）
        this.lowThresholdMultiplier = options.lowThresholdMultiplier || 1.5;      // 预激活阈值倍数
        this.highThresholdMultiplier = options.highThresholdMultiplier || 3.0;     // 确认说话阈值倍数
        this.minThreshold = options.minThreshold || 20;             // 动态阈值的最小值（默认 20）
        this.isCalibrated = false;              // 是否已校准
        this.lastNoiseUpdateTime = 0;           // 上次更新噪音基准的时间

        // 状态机：IDLE | PRE_ACTIVE | SPEAKING
        this.state = 'IDLE';
        this.preActiveStartTime = 0;
        this.speechStartTime = 0;
        this.silenceStartTime = 0;
        this.lastSpeechTime = 0;

        // 能量趋势追踪（用于判断能量是否持续上升）
        this.energyTrend = [];                  // 最近的能量值（滑动窗口）
        this.energyTrendWindow = 5;             // 趋势窗口大小（5 帧 = 500ms）

        // 回调函数
        this.onSpeakingStart = null;
        this.onSpeakingEnd = null;
        this.onCalibrationComplete = null;      // 校准完成回调

        // 检测循环
        this.detectionInterval = null;
        this.isRunning = false;

        // 数据缓冲
        this.dataArray = new Uint8Array(analyser.frequencyBinCount);

        // 调试
        this.lastLogTime = 0;
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
        this.state = 'IDLE';
        this.preActiveStartTime = 0;
        this.speechStartTime = 0;
        this.silenceStartTime = 0;
        this.lastSpeechTime = 0;
        this.energyTrend = [];
        this.noiseHistory = [];
        this.isCalibrated = false;
        this.noiseBaseline = null;

        console.log('🎙️ SpeechDetector 启动中...');
        console.log(`   - 校准时长: ${this.calibrationDuration}ms`);
        console.log(`   - 检测间隔: ${interval}ms`);

        // 开始校准阶段
        this._startCalibration(interval);

        this.detectionInterval = setInterval(() => {
            this._detect();
        }, interval);

        this.isRunning = true;
    }

    /**
     * 开始校准（采样背景噪音）
     * @private
     */
    _startCalibration(interval) {
        console.log('📊 开始校准背景噪音...');

        const calibrationStartTime = Date.now();
        const calibrationInterval = setInterval(() => {
            const energy = this._getAudioEnergy();
            this.noiseHistory.push(energy);

            const elapsed = Date.now() - calibrationStartTime;
            if (elapsed >= this.calibrationDuration) {
                clearInterval(calibrationInterval);
                this._completeCalibration();
            }
        }, interval);
    }

    /**
     * 完成校准
     * @private
     */
    _completeCalibration() {
        if (this.noiseHistory.length === 0) {
            console.warn('⚠️ 校准失败：无有效数据，使用默认阈值');
            this.noiseBaseline = this.baseThreshold / this.highThresholdMultiplier;
            this.isCalibrated = true;
            return;
        }

        // 使用中位数作为噪音基准（比平均值更鲁棒，抗异常值干扰）
        this.noiseBaseline = this._median(this.noiseHistory);
        this.isCalibrated = true;
        this.lastNoiseUpdateTime = Date.now();

        const lowThreshold = this.getLowThreshold();
        const highThreshold = this.getHighThreshold();

        console.log('✅ 校准完成！');
        console.log(`   - 背景噪音基准: ${this.noiseBaseline.toFixed(1)}`);
        console.log(`   - 预激活阈值: ${lowThreshold.toFixed(1)} (基准 × ${this.lowThresholdMultiplier})`);
        console.log(`   - 确认阈值: ${highThreshold.toFixed(1)} (基准 × ${this.highThresholdMultiplier})`);

        if (this.onCalibrationComplete) {
            this.onCalibrationComplete({
                noiseBaseline: this.noiseBaseline,
                lowThreshold: lowThreshold,
                highThreshold: highThreshold
            });
        }
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
        if (this.state === 'SPEAKING' && this.onSpeakingEnd) {
            this.onSpeakingEnd();
        }

        this.state = 'IDLE';

        console.log('⏹ SpeechDetector stopped');
    }

    /**
     * 执行检测
     * @private
     */
    _detect() {
        // 如果尚未校准，跳过检测
        if (!this.isCalibrated) {
            return;
        }

        const now = Date.now();
        const energy = this._getAudioEnergy();

        // 获取动态阈值
        const lowThreshold = this.getLowThreshold();
        const highThreshold = this.getHighThreshold();

        // 更新能量趋势
        this.energyTrend.push(energy);
        if (this.energyTrend.length > this.energyTrendWindow) {
            this.energyTrend.shift();
        }

        // 调试日志（每秒打印一次）
        if (now - this.lastLogTime > 1000) {
            const stateEmoji = {
                'IDLE': '⚪',
                'PRE_ACTIVE': '🟡',
                'SPEAKING': '🟢'
            };
            console.log(`[VAD] 能量: ${energy.toFixed(1)} | 阈值: [${lowThreshold.toFixed(1)}, ${highThreshold.toFixed(1)}] | 状态: ${stateEmoji[this.state]} ${this.state} | 检测运行中`);
            this.lastLogTime = now;
        }

        // 额外检测：当能量很高时，也打印日志（帮助调试为什么不触发）
        if (energy > highThreshold && this.state === 'IDLE') {
            console.log(`[VAD] ⚠️ 检测到高能量 ${energy.toFixed(1)} > ${highThreshold.toFixed(1)}，但状态仍是 IDLE`);
        }

        // 状态机逻辑
        switch (this.state) {
            case 'IDLE':
                this._handleIdleState(energy, lowThreshold, now);
                break;

            case 'PRE_ACTIVE':
                this._handlePreActiveState(energy, lowThreshold, highThreshold, now);
                break;

            case 'SPEAKING':
                this._handleSpeakingState(energy, lowThreshold, now);
                break;
        }

        // 定期更新噪音基准（仅在 IDLE 状态下）
        if (this.state === 'IDLE' && now - this.lastNoiseUpdateTime > this.noiseUpdateInterval) {
            this._updateNoiseBaseline(energy);
        }
    }

    /**
     * 处理 IDLE 状态
     * @private
     */
    _handleIdleState(energy, lowThreshold, now) {
        if (energy > lowThreshold) {
            // 能量超过预激活阈值，进入 PRE_ACTIVE
            this.state = 'PRE_ACTIVE';
            this.preActiveStartTime = now;
            this.energyTrend = [energy];
            console.log(`[VAD] 🟡 进入预激活状态 (能量: ${energy.toFixed(1)} > ${lowThreshold.toFixed(1)})`);
        }
    }

    /**
     * 处理 PRE_ACTIVE 状态
     * @private
     */
    _handlePreActiveState(energy, lowThreshold, highThreshold, now) {
        const elapsed = now - this.preActiveStartTime;

        // 检查能量是否持续上升
        const isRising = this._isEnergyRising();

        // 确认为说话的条件：
        // 1. 能量持续上升超过 300ms，或
        // 2. 能量超过高阈值
        if ((isRising && elapsed >= 300) || energy > highThreshold) {
            this.state = 'SPEAKING';
            this.speechStartTime = this.preActiveStartTime;
            this.silenceStartTime = 0;
            this.lastSpeechTime = now;

            console.log(`[VAD] 🟢 确认说话开始！(${isRising ? '能量持续上升' : '超过高阈值'}, 持续 ${elapsed}ms)`);

            if (this.onSpeakingStart) {
                this.onSpeakingStart();
            }
        }
        // 能量回落，取消预激活
        else if (energy < lowThreshold && elapsed > 500) {
            this.state = 'IDLE';
            this.preActiveStartTime = 0;
            console.log(`[VAD] ⚪ 预激活取消 (能量回落)`);
        }
    }

    /**
     * 处理 SPEAKING 状态
     * @private
     */
    _handleSpeakingState(energy, lowThreshold, now) {
        if (energy > lowThreshold) {
            // 仍在说话
            this.lastSpeechTime = now;
            this.silenceStartTime = 0;
        } else {
            // 检测到静音
            if (this.silenceStartTime === 0) {
                this.silenceStartTime = now;
                console.log(`[VAD] 🔇 检测到静音，等待持续 ${this.silenceDuration}ms...`);
            }

            const silenceDuration = now - this.silenceStartTime;
            if (silenceDuration >= this.silenceDuration) {
                // 持续静音超过阈值，说话结束
                const speakDuration = this.lastSpeechTime - this.speechStartTime;

                // ✅ 验证说话时长是否满足最小要求
                if (speakDuration < this.minSpeakDuration) {
                    console.log(`[VAD] ⚠️ 说话时长不足 (${(speakDuration / 1000).toFixed(1)}s < ${(this.minSpeakDuration / 1000).toFixed(1)}s)，忽略此次说话`);

                    // 重置状态，不触发回调
                    this.state = 'IDLE';
                    this.speechStartTime = 0;
                    this.silenceStartTime = 0;
                    this.preActiveStartTime = 0;
                    return;
                }

                // 说话时长有效，触发回调
                this.state = 'IDLE';
                this.speechStartTime = 0;
                this.silenceStartTime = 0;
                this.preActiveStartTime = 0;

                console.log(`[VAD] ⏹️ 说话结束！总时长: ${(speakDuration / 1000).toFixed(1)}s, 静音: ${silenceDuration}ms`);

                if (this.onSpeakingEnd) {
                    this.onSpeakingEnd();
                }
            }
        }
    }

    /**
     * 判断能量是否持续上升
     * @private
     * @returns {boolean}
     */
    _isEnergyRising() {
        if (this.energyTrend.length < 3) {
            return false;
        }

        // 计算趋势：最近的能量 vs 早期的能量
        const recentAvg = this._average(this.energyTrend.slice(-2));  // 最近 2 帧
        const earlyAvg = this._average(this.energyTrend.slice(0, 2)); // 早期 2 帧

        // 如果最近能量比早期能量高 20%，认为是上升趋势
        return recentAvg > earlyAvg * 1.2;
    }

    /**
     * 更新噪音基准
     * @private
     */
    _updateNoiseBaseline(energy) {
        // 只在静音时采样（避免把说话声音当作噪音）
        this.noiseHistory.push(energy);

        // 保留最近 30 个采样点
        if (this.noiseHistory.length > 30) {
            this.noiseHistory.shift();
        }

        // 重新计算噪音基准
        const newBaseline = this._median(this.noiseHistory);

        // 平滑更新（避免突变）
        this.noiseBaseline = this.noiseBaseline * 0.8 + newBaseline * 0.2;
        this.lastNoiseUpdateTime = Date.now();

        console.log(`[VAD] 📊 噪音基准已更新: ${this.noiseBaseline.toFixed(1)}`);
    }

    /**
     * 获取预激活阈值（低阈值）
     * @returns {number}
     */
    getLowThreshold() {
        if (!this.isCalibrated || this.noiseBaseline === null) {
            return Math.max(this.baseThreshold * 0.5, this.minThreshold);
        }
        const dynamicThreshold = this.noiseBaseline * this.lowThresholdMultiplier;
        return Math.max(dynamicThreshold, this.minThreshold);
    }

    /**
     * 获取确认阈值（高阈值）
     * @returns {number}
     */
    getHighThreshold() {
        if (!this.isCalibrated || this.noiseBaseline === null) {
            return Math.max(this.baseThreshold, this.minThreshold * 1.5);
        }
        const dynamicThreshold = this.noiseBaseline * this.highThresholdMultiplier;
        return Math.max(dynamicThreshold, this.minThreshold * 1.5);
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
     * 计算中位数
     * @private
     */
    _median(array) {
        if (array.length === 0) return 0;
        const sorted = [...array].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }

    /**
     * 计算平均值
     * @private
     */
    _average(array) {
        if (array.length === 0) return 0;
        return array.reduce((sum, val) => sum + val, 0) / array.length;
    }

    /**
     * 获取当前是否在说话
     * @returns {boolean}
     */
    getSpeakingState() {
        return this.state === 'SPEAKING';
    }

    /**
     * 获取当前音频能量
     * @returns {number} 当前能量值 (0-255)
     */
    getCurrentEnergy() {
        return this._getAudioEnergy();
    }

    /**
     * 获取当前状态
     * @returns {string} 'IDLE' | 'PRE_ACTIVE' | 'SPEAKING'
     */
    getCurrentState() {
        return this.state;
    }

    /**
     * 获取噪音基准
     * @returns {number|null}
     */
    getNoiseBaseline() {
        return this.noiseBaseline;
    }

    /**
     * 手动设置噪音基准（用于跳过自动校准）
     * @param {number} baseline - 噪音基准值
     */
    setNoiseBaseline(baseline) {
        this.noiseBaseline = baseline;
        this.isCalibrated = true;
        console.log(`[VAD] 手动设置噪音基准: ${baseline.toFixed(1)}`);
    }

    /**
     * 设置阈值倍数
     * @param {number} lowMultiplier - 预激活阈值倍数
     * @param {number} highMultiplier - 确认阈值倍数
     */
    setThresholdMultipliers(lowMultiplier, highMultiplier) {
        this.lowThresholdMultiplier = lowMultiplier;
        this.highThresholdMultiplier = highMultiplier;
        console.log(`[VAD] 阈值倍数已更新: 低=${lowMultiplier}, 高=${highMultiplier}`);
    }

    /**
     * 销毁检测器
     */
    destroy() {
        this.stop();
        this.onSpeakingStart = null;
        this.onSpeakingEnd = null;
        this.onCalibrationComplete = null;
        this.dataArray = null;
        this.noiseHistory = [];
        this.energyTrend = [];
    }
}
