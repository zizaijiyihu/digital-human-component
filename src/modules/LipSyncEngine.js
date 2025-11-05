import { DEFAULT_CONFIG } from '../config/defaults.js';

/**
 * 口型同步引擎
 */
export class LipSyncEngine {
    constructor(morphTargetMesh) {
        if (!morphTargetMesh) {
            throw new Error('LipSyncEngine: morphTargetMesh is required');
        }

        this.morphTargetMesh = morphTargetMesh;
        this.morphTargetDict = morphTargetMesh.morphTargetDictionary;

        // 音频上下文
        this.audioContext = null;
        this.analyser = null;
        this.audioSource = null;

        // 状态
        this.isActive = false;
        this.isClosing = false;
        this.animationId = null;

        // 音素状态
        this.currentPhoneme = 'sil';
        this.currentViseme = 'viseme_sil';
        this.lastPhonemeTime = 0;

        // 配置
        this.config = DEFAULT_CONFIG.LIP_SYNC;
        this.phonemeMap = DEFAULT_CONFIG.PHONEME_TO_VISEME;
    }

    /**
     * 启动口型同步
     */
    start(audioElement) {
        if (!this.morphTargetMesh) {
            console.error('❌ morphTargetMesh not initialized');
            return;
        }

        // 初始化音频上下文
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.config.fftSize;
            this.analyser.connect(this.audioContext.destination);
        }

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // 连接音频源
        if (this.audioSource) {
            this.audioSource.disconnect();
        }

        try {
            this.audioSource = this.audioContext.createMediaElementSource(audioElement);
            this.audioSource.connect(this.analyser);
        } catch (e) {
            console.error('Failed to create audio source:', e);
            return;
        }

        // 重置状态
        this.isActive = true;
        this.isClosing = false;
        this.currentPhoneme = 'sil';
        this.currentViseme = 'viseme_sil';
        this.lastPhonemeTime = Date.now();

        // 开始更新循环
        this._update(audioElement);
    }

    /**
     * 停止口型同步
     */
    stop() {
        if (!this.isActive && !this.isClosing) {
            return;
        }

        this.isActive = false;
        this.isClosing = true;
    }

    /**
     * 更新循环
     */
    _update(audioElement) {
        if (!this.isActive && !this.isClosing) {
            return;
        }

        // 闭合逻辑
        if (this.isClosing) {
            let allClosed = true;

            // 衰减所有 visemes
            Object.values(this.phonemeMap).forEach(visemeName => {
                const idx = this.morphTargetDict[visemeName];
                if (idx !== undefined) {
                    const val = this.morphTargetMesh.morphTargetInfluences[idx] || 0;
                    if (val > 0.001) {
                        this.morphTargetMesh.morphTargetInfluences[idx] = val * this.config.decayRate.closing;
                        allClosed = false;
                    } else {
                        this.morphTargetMesh.morphTargetInfluences[idx] = 0;
                    }
                }
            });

            // 衰减 jawOpen
            const jawIdx = this.morphTargetDict['jawOpen'];
            if (jawIdx !== undefined) {
                const val = this.morphTargetMesh.morphTargetInfluences[jawIdx] || 0;
                if (val > 0.001) {
                    this.morphTargetMesh.morphTargetInfluences[jawIdx] = val * this.config.decayRate.closing;
                    allClosed = false;
                } else {
                    this.morphTargetMesh.morphTargetInfluences[jawIdx] = 0;
                }
            }

            if (allClosed) {
                this.isClosing = false;
                return;
            }

            requestAnimationFrame(() => this._update(audioElement));
            return;
        }

        // 检查音频是否结束
        if (audioElement.ended || audioElement.currentTime >= audioElement.duration - 0.05) {
            this.isActive = false;
            this.isClosing = true;
            requestAnimationFrame(() => this._update(audioElement));
            return;
        }

        // 继续更新
        requestAnimationFrame(() => this._update(audioElement));

        // 获取频率数据
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);

        // 频段分析（5段）
        let veryLow = 0, low = 0, mid = 0, high = 0, veryHigh = 0;

        for (let i = 0; i < 15; i++) veryLow += dataArray[i];
        for (let i = 15; i < 35; i++) low += dataArray[i];
        for (let i = 35; i < 70; i++) mid += dataArray[i];
        for (let i = 70; i < 120; i++) high += dataArray[i];
        for (let i = 120; i < 180; i++) veryHigh += dataArray[i];

        veryLow /= 15 * 255;
        low /= 20 * 255;
        mid /= 35 * 255;
        high /= 50 * 255;
        veryHigh /= 60 * 255;

        const totalVolume = (veryLow + low + mid + high + veryHigh) / 5;
        const currentTime = audioElement.currentTime;
        const syllableProgress = (currentTime * 1000 % this.config.syllableDuration) / this.config.syllableDuration;

        // 音素推断
        let detectedPhoneme = 'sil';
        let detectedViseme = 'viseme_sil';

        // 基于时间的强制闭合
        if (syllableProgress > (1 - this.config.closeRatio)) {
            detectedPhoneme = 'sil';
            detectedViseme = 'viseme_sil';
        }
        // 静音检测
        else if (totalVolume < 0.05) {
            detectedPhoneme = 'sil';
            detectedViseme = 'viseme_sil';
        }
        // 高频辅音 SS
        else if (high > 0.25 && high / (low + veryLow + 0.001) > 1.5) {
            detectedPhoneme = 'SS';
            detectedViseme = 'viseme_SS';
        }
        // 超高频辅音 kk
        else if (veryHigh > 0.2) {
            detectedPhoneme = 'kk';
            detectedViseme = 'viseme_kk';
        }
        // 中频辅音 CH (映射到 SS)
        else if (mid > 0.25 && high > 0.15) {
            detectedPhoneme = 'CH';
            detectedViseme = 'viseme_SS';
        }
        // 中频辅音 DD
        else if (mid > 0.3) {
            detectedPhoneme = 'DD';
            detectedViseme = 'viseme_DD';
        }
        // 低频元音 aa/O
        else if (veryLow > low && veryLow > 0.2) {
            detectedPhoneme = veryLow > 0.35 ? 'aa' : 'O';
            detectedViseme = detectedPhoneme === 'aa' ? 'viseme_aa' : 'viseme_O';
        }
        // 中低频元音 E/I
        else if (low > 0.2) {
            detectedPhoneme = low > mid * 1.3 ? 'E' : 'I';
            detectedViseme = detectedPhoneme === 'E' ? 'viseme_E' : 'viseme_I';
        }
        // 默认元音 aa
        else {
            detectedPhoneme = 'aa';
            detectedViseme = 'viseme_aa';
        }

        // 音素切换（防抖：80ms）
        const now = Date.now();
        if (detectedPhoneme !== this.currentPhoneme && now - this.lastPhonemeTime > 80) {
            this.currentPhoneme = detectedPhoneme;
            this.currentViseme = detectedViseme;
            this.lastPhonemeTime = now;
        }

        // 更新 morph targets
        const currentIdx = this.morphTargetDict[this.currentViseme];
        if (currentIdx !== undefined) {
            const curr = this.morphTargetMesh.morphTargetInfluences[currentIdx] || 0;
            const target = Math.min(totalVolume * 1.2, 0.7);
            this.morphTargetMesh.morphTargetInfluences[currentIdx] = curr * 0.7 + target * 0.3;
        }

        // 衰减其他 visemes
        const decayRate = this.currentPhoneme === 'sil' ? this.config.decayRate.silence : this.config.decayRate.normal;
        Object.values(this.phonemeMap).forEach(visemeName => {
            if (visemeName !== this.currentViseme) {
                const idx = this.morphTargetDict[visemeName];
                if (idx !== undefined) {
                    this.morphTargetMesh.morphTargetInfluences[idx] *= decayRate;
                }
            }
        });

        // 控制 jawOpen
        const jawIdx = this.morphTargetDict['jawOpen'];
        if (jawIdx !== undefined) {
            if (this.currentPhoneme === 'sil') {
                const curr = this.morphTargetMesh.morphTargetInfluences[jawIdx] || 0;
                this.morphTargetMesh.morphTargetInfluences[jawIdx] = curr * 0.4;
            } else {
                let jawValue = 0;
                if (['aa', 'E', 'O', 'I', 'U'].includes(this.currentPhoneme)) {
                    jawValue = totalVolume * 0.5;
                } else if (['DD', 'nn', 'CH', 'SS'].includes(this.currentPhoneme)) {
                    jawValue = totalVolume * 0.2;
                }
                const curr = this.morphTargetMesh.morphTargetInfluences[jawIdx] || 0;
                this.morphTargetMesh.morphTargetInfluences[jawIdx] = curr * 0.7 + jawValue * 0.3;
            }
        }
    }

    /**
     * 销毁
     */
    destroy() {
        this.stop();

        if (this.audioSource) {
            this.audioSource.disconnect();
            this.audioSource = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}
