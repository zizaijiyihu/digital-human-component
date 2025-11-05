import { DEFAULT_CONFIG } from '../config/defaults.js';

/**
 * 表情管理器
 */
export class ExpressionManager {
    constructor(morphTargetMesh, headBone, neckBone, config = {}) {
        this.morphTargetMesh = morphTargetMesh;
        this.morphTargetDict = morphTargetMesh ? morphTargetMesh.morphTargetDictionary : {};
        this.headBone = headBone;
        this.neckBone = neckBone;
        this.config = config;

        // 状态
        this.mode = null; // 'listening' | 'speaking' | null
        this.intervals = [];
    }

    /**
     * 启动聆听模式
     */
    startListeningMode() {
        this.stopAll();
        this.mode = 'listening';

        const freq = this.config.expressionFrequency || DEFAULT_CONFIG.EXPRESSION_FREQUENCY;

        // 随机眨眼
        if (this.config.enableBlinking !== false) {
            this._scheduleExpression('blink', freq.blink.min, freq.blink.max);
        }

        // 随机微笑
        if (this.config.enableSmiling !== false) {
            this._scheduleExpression('smile', freq.smile.min, freq.smile.max);
        }

        // 随机点头
        if (this.config.enableNodding !== false) {
            this._scheduleExpression('nod', freq.nod.min, freq.nod.max);
        }

        // 随机眉毛上扬
        if (this.config.enableBrowRaising !== false) {
            this._scheduleExpression('raiseBrows', freq.browRaise.min, freq.browRaise.max);
        }

        // 随机头部倾斜
        if (this.config.enableHeadTilting !== false) {
            this._scheduleExpression('tiltHead', freq.headTilt.min, freq.headTilt.max);
        }
    }

    /**
     * 停止聆听模式
     */
    stopListeningMode() {
        if (this.mode !== 'listening') {
            return;
        }
        this.stopAll();
    }

    /**
     * 启动说话模式
     */
    startSpeakingMode() {
        this.stopAll();
        this.mode = 'speaking';

        // 说话时只保留眨眼
        if (this.config.enableBlinking !== false) {
            const freq = this.config.expressionFrequency || DEFAULT_CONFIG.EXPRESSION_FREQUENCY;
            this._scheduleExpression('blink', freq.blink.min + 500, freq.blink.max + 500);
        }
    }

    /**
     * 停止说话模式
     */
    stopSpeakingMode() {
        if (this.mode !== 'speaking') {
            return;
        }
        this.stopAll();
    }

    /**
     * 停止所有表情
     */
    stopAll() {
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];
        this.mode = null;
    }

    /**
     * 调度表情
     */
    _scheduleExpression(expressionName, minInterval, maxInterval) {
        const execute = () => {
            if (this[expressionName]) {
                this[expressionName]();
            }

            // 下一次执行时间（随机）
            const nextDelay = Math.random() * (maxInterval - minInterval) + minInterval;
            const interval = setTimeout(execute, nextDelay);
            this.intervals.push(interval);
        };

        // 首次延迟执行
        const firstDelay = Math.random() * (maxInterval - minInterval) + minInterval;
        const interval = setTimeout(execute, firstDelay);
        this.intervals.push(interval);
    }

    /**
     * 眨眼
     */
    blink() {
        if (!this.morphTargetMesh) return;

        const dict = this.morphTargetDict;
        const influences = this.morphTargetMesh.morphTargetInfluences;

        const leftIdx = dict['eyeBlinkLeft'];
        const rightIdx = dict['eyeBlinkRight'];

        if (leftIdx === undefined || rightIdx === undefined) return;

        const params = DEFAULT_CONFIG.EXPRESSIONS.blink;
        const duration = params.duration;

        // 闭眼
        this._tween(
            { value: 0 },
            { value: params.intensity },
            duration,
            (obj) => {
                influences[leftIdx] = obj.value;
                influences[rightIdx] = obj.value;
            },
            () => {
                // 睁眼
                this._tween(
                    { value: params.intensity },
                    { value: 0 },
                    duration,
                    (obj) => {
                        influences[leftIdx] = obj.value;
                        influences[rightIdx] = obj.value;
                    }
                );
            }
        );
    }

    /**
     * 微笑
     */
    smile() {
        if (!this.morphTargetMesh) return;

        const dict = this.morphTargetDict;
        const influences = this.morphTargetMesh.morphTargetInfluences;

        const leftIdx = dict['mouthSmileLeft'];
        const rightIdx = dict['mouthSmileRight'];

        if (leftIdx === undefined || rightIdx === undefined) return;

        const params = DEFAULT_CONFIG.EXPRESSIONS.smile;

        // 渐入
        this._tween(
            { value: 0 },
            { value: params.intensity },
            params.fadeIn,
            (obj) => {
                influences[leftIdx] = obj.value;
                influences[rightIdx] = obj.value;
            },
            () => {
                // 保持
                const holdTime = Math.random() * (params.hold.max - params.hold.min) + params.hold.min;
                setTimeout(() => {
                    // 渐出
                    this._tween(
                        { value: params.intensity },
                        { value: 0 },
                        params.fadeOut,
                        (obj) => {
                            influences[leftIdx] = obj.value;
                            influences[rightIdx] = obj.value;
                        }
                    );
                }, holdTime);
            }
        );
    }

    /**
     * 点头
     */
    nod() {
        if (!this.headBone) return;

        const originalRotation = this.headBone.rotation.x;
        const params = DEFAULT_CONFIG.EXPRESSIONS.nod;

        // 向下
        this._tween(
            { x: originalRotation },
            { x: originalRotation + params.intensity },
            params.duration,
            (obj) => {
                this.headBone.rotation.x = obj.x;
            },
            () => {
                // 恢复
                this._tween(
                    { x: originalRotation + params.intensity },
                    { x: originalRotation },
                    params.duration,
                    (obj) => {
                        this.headBone.rotation.x = obj.x;
                    }
                );
            }
        );
    }

    /**
     * 眉毛上扬
     */
    raiseBrows() {
        if (!this.morphTargetMesh) return;

        const dict = this.morphTargetDict;
        const influences = this.morphTargetMesh.morphTargetInfluences;

        const browIdx = dict['browInnerUp'];
        if (browIdx === undefined) return;

        const params = DEFAULT_CONFIG.EXPRESSIONS.browRaise;

        // 上扬
        this._tween(
            { value: 0 },
            { value: params.intensity },
            params.duration,
            (obj) => {
                influences[browIdx] = obj.value;
            },
            () => {
                // 恢复
                this._tween(
                    { value: params.intensity },
                    { value: 0 },
                    params.hold,
                    (obj) => {
                        influences[browIdx] = obj.value;
                    }
                );
            }
        );
    }

    /**
     * 头部倾斜
     */
    tiltHead() {
        if (!this.headBone) return;

        const originalRotation = this.headBone.rotation.z;
        const direction = Math.random() > 0.5 ? 1 : -1;
        const params = DEFAULT_CONFIG.EXPRESSIONS.headTilt;

        // 倾斜
        this._tween(
            { z: originalRotation },
            { z: originalRotation + (params.intensity * direction) },
            params.duration,
            (obj) => {
                this.headBone.rotation.z = obj.z;
            },
            () => {
                // 保持
                setTimeout(() => {
                    // 恢复
                    this._tween(
                        { z: originalRotation + (params.intensity * direction) },
                        { z: originalRotation },
                        params.duration,
                        (obj) => {
                            this.headBone.rotation.z = obj.z;
                        }
                    );
                }, params.hold);
            }
        );
    }

    /**
     * 简单的 Tween 实现（不依赖 TWEEN.js）
     */
    _tween(from, to, duration, onUpdate, onComplete) {
        const startTime = Date.now();
        const keys = Object.keys(to);

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 缓动函数（easeInOutQuad）
            const eased = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            // 更新值
            keys.forEach(key => {
                from[key] = from[key] + (to[key] - from[key]) * eased;
            });

            onUpdate(from);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else if (onComplete) {
                onComplete();
            }
        };

        animate();
    }

    /**
     * 销毁
     */
    destroy() {
        this.stopAll();
    }
}
