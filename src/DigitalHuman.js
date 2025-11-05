import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DEFAULT_CONFIG } from './config/defaults.js';
import { SceneManager } from './modules/SceneManager.js';
import { AnimationController } from './modules/AnimationController.js';
import { LipSyncEngine } from './modules/LipSyncEngine.js';
import { ExpressionManager } from './modules/ExpressionManager.js';
import { EventEmitter } from './utils/EventEmitter.js';

/**
 * 数字人组件
 */
export class DigitalHuman extends EventEmitter {
    constructor(options = {}) {
        super();

        // 合并配置
        this.config = {
            // 必选
            container: options.container,
            modelUrl: options.modelUrl,

            // 动画配置
            useDefaultAnimations: options.useDefaultAnimations !== false,
            animations: {
                idle: options.animations?.idle || null,
                talking: options.animations?.talking || null
            },

            // 背景配置
            backgroundColor: options.backgroundColor || '#1a1a2e',
            backgroundImage: options.backgroundImage || null,

            // 尺寸
            width: options.width || 600,
            height: options.height || 600,

            // 相机配置
            cameraPosition: options.cameraPosition || DEFAULT_CONFIG.CAMERA.position,
            cameraTarget: options.cameraTarget || DEFAULT_CONFIG.CAMERA.target,

            // 行为配置
            autoStart: options.autoStart || null,
            enableBlinking: options.enableBlinking !== false,
            enableSmiling: options.enableSmiling !== false,
            enableNodding: options.enableNodding !== false,
            enableBrowRaising: options.enableBrowRaising !== false,
            enableHeadTilting: options.enableHeadTilting !== false,

            // 表情频率
            expressionFrequency: {
                ...DEFAULT_CONFIG.EXPRESSION_FREQUENCY,
                ...options.expressionFrequency
            },

            // 回调
            onReady: options.onReady || null,
            onSpeakStart: options.onSpeakStart || null,
            onSpeakEnd: options.onSpeakEnd || null,
            onListenStart: options.onListenStart || null,
            onListenEnd: options.onListenEnd || null,
            onError: options.onError || null,

            // 调试
            showControls: options.showControls || false,
            enableOrbitControls: options.enableOrbitControls !== false,
            debug: options.debug || false
        };

        // 验证必选参数
        if (!this.config.container) {
            throw new Error('DigitalHuman: container is required');
        }
        if (!this.config.modelUrl) {
            throw new Error('DigitalHuman: modelUrl is required');
        }

        // 状态
        this.isReady = false;
        this.currentMode = null; // 'listening' | 'speaking' | null
        this.isDestroyed = false;

        // 子模块
        this.sceneManager = null;
        this.animationController = null;
        this.lipSyncEngine = null;
        this.expressionManager = null;

        // 资源引用
        this.avatar = null;
        this.morphTargetMesh = null;
        this.headBone = null;
        this.neckBone = null;

        // 初始化
        this._init();
    }

    /**
     * 初始化
     */
    async _init() {
        try {
            // 1. 创建场景管理器
            const container = typeof this.config.container === 'string'
                ? document.querySelector(this.config.container)
                : this.config.container;

            if (!container) {
                throw new Error('Container not found');
            }

            this.sceneManager = new SceneManager(container, {
                width: this.config.width,
                height: this.config.height,
                backgroundColor: this.config.backgroundColor,
                backgroundImage: this.config.backgroundImage,
                cameraPosition: this.config.cameraPosition,
                cameraTarget: this.config.cameraTarget,
                enableOrbitControls: this.config.enableOrbitControls
            });

            // 2. 加载模型
            await this._loadModel();

            // 3. 初始化子模块
            this.animationController = new AnimationController(this.avatar, this.sceneManager.mixer);
            this.lipSyncEngine = new LipSyncEngine(this.morphTargetMesh);
            this.expressionManager = new ExpressionManager(
                this.morphTargetMesh,
                this.headBone,
                this.neckBone,
                this.config
            );

            // 4. 加载动画
            await this._loadAnimations();

            // 5. 设置背景图片（如果有）
            if (this.config.backgroundImage) {
                await this.setBackgroundImage(this.config.backgroundImage);
            }

            // 6. 自动启动模式
            if (this.config.autoStart === 'listening') {
                this.startListening();
            } else if (this.config.autoStart === 'speaking') {
                // 说话模式需要音频，不自动启动
                console.warn('DigitalHuman: autoStart "speaking" requires audio, skipping');
            }

            // 7. 标记为就绪
            this.isReady = true;
            this.emit('ready');
            if (this.config.onReady) {
                this.config.onReady();
            }

            if (this.config.debug) {
                console.log('✅ DigitalHuman initialized');
            }

        } catch (error) {
            console.error('DigitalHuman initialization failed:', error);
            this.emit('error', error);
            if (this.config.onError) {
                this.config.onError(error);
            }
        }
    }

    /**
     * 加载模型
     */
    async _loadModel() {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load(
                this.config.modelUrl,
                (gltf) => {
                    this.avatar = gltf.scene;
                    this.sceneManager.scene.add(this.avatar);

                    // 查找 morph target mesh 和骨骼
                    this.avatar.traverse((node) => {
                        if (node.isMesh && node.morphTargetDictionary && node.morphTargetInfluences) {
                            this.morphTargetMesh = node;
                        }

                        if (node.isBone || node.type === 'Bone') {
                            const name = node.name.toLowerCase();
                            if (name.includes('head')) {
                                this.headBone = node;
                            }
                            if (name.includes('neck')) {
                                this.neckBone = node;
                            }
                        }
                    });

                    if (!this.morphTargetMesh) {
                        reject(new Error('Model does not have morph targets'));
                        return;
                    }

                    // 让头部看向相机
                    if (this.headBone) {
                        const lookAtTarget = new THREE.Vector3(
                            this.config.cameraPosition.x,
                            this.config.cameraPosition.y,
                            this.config.cameraPosition.z
                        );
                        this.headBone.lookAt(lookAtTarget);
                    }

                    resolve();
                },
                undefined,
                reject
            );
        });
    }

    /**
     * 加载动画
     */
    async _loadAnimations() {
        const animations = {
            idle: this.config.animations.idle ||
                  (this.config.useDefaultAnimations ? DEFAULT_CONFIG.DEFAULT_ANIMATIONS.idle : null),
            talking: this.config.animations.talking ||
                     (this.config.useDefaultAnimations ? DEFAULT_CONFIG.DEFAULT_ANIMATIONS.talking : null)
        };

        const promises = [];
        if (animations.idle) {
            promises.push(this.animationController.loadAnimation('idle', animations.idle));
        }
        if (animations.talking) {
            promises.push(this.animationController.loadAnimation('talking', animations.talking));
        }

        await Promise.all(promises);
    }

    /**
     * 启动聆听模式
     */
    startListening() {
        if (!this.isReady) {
            console.warn('DigitalHuman: not ready yet');
            return;
        }

        if (this.currentMode === 'listening') {
            return;
        }

        // 停止说话模式
        if (this.currentMode === 'speaking') {
            this.stopSpeaking();
        }

        this.currentMode = 'listening';

        // 播放待机动画
        this.animationController.play('idle');

        // 启动表情管理器
        this.expressionManager.startListeningMode();

        this.emit('listenStart');
        if (this.config.onListenStart) {
            this.config.onListenStart();
        }

        if (this.config.debug) {
            console.log('👂 Listening mode started');
        }
    }

    /**
     * 停止聆听模式
     */
    stopListening() {
        if (this.currentMode !== 'listening') {
            return;
        }

        this.currentMode = null;

        // 停止动画
        this.animationController.stop('idle');

        // 停止表情
        this.expressionManager.stopListeningMode();

        this.emit('listenEnd');
        if (this.config.onListenEnd) {
            this.config.onListenEnd();
        }

        if (this.config.debug) {
            console.log('⏹ Listening mode stopped');
        }
    }

    /**
     * 说话（播放音频）
     * @param {string|Blob|ArrayBuffer|MediaStream} audio - 音频源
     */
    async speak(audio) {
        if (!this.isReady) {
            console.warn('DigitalHuman: not ready yet');
            return;
        }

        // 停止聆听模式
        if (this.currentMode === 'listening') {
            this.stopListening();
        }

        this.currentMode = 'speaking';

        // 播放说话动画
        this.animationController.play('talking');

        // 启动说话时的眨眼
        this.expressionManager.startSpeakingMode();

        // 处理音频
        let audioElement;
        if (typeof audio === 'string') {
            // URL
            audioElement = new Audio(audio);
        } else if (audio instanceof Blob) {
            // Blob
            audioElement = new Audio(URL.createObjectURL(audio));
        } else if (audio instanceof ArrayBuffer) {
            // ArrayBuffer
            const blob = new Blob([audio], { type: 'audio/wav' });
            audioElement = new Audio(URL.createObjectURL(blob));
        } else {
            throw new Error('Unsupported audio type');
        }

        audioElement.crossOrigin = "anonymous";

        // 音频事件
        audioElement.addEventListener('play', () => {
            this.lipSyncEngine.start(audioElement);
            this.emit('speakStart', audio);
            if (this.config.onSpeakStart) {
                this.config.onSpeakStart(audio);
            }
        });

        audioElement.addEventListener('ended', () => {
            this.lipSyncEngine.stop();
            this.emit('speakEnd');
            if (this.config.onSpeakEnd) {
                this.config.onSpeakEnd();
            }
        });

        audioElement.addEventListener('error', (e) => {
            console.error('Audio playback error:', e);
            this.emit('error', e);
            if (this.config.onError) {
                this.config.onError(e);
            }
        });

        // 播放
        try {
            await audioElement.play();
            if (this.config.debug) {
                console.log('🗣️ Speaking mode started');
            }
        } catch (error) {
            console.error('Audio play failed:', error);
            throw error;
        }

        return audioElement;
    }

    /**
     * 停止说话
     */
    stopSpeaking() {
        if (this.currentMode !== 'speaking') {
            return;
        }

        this.currentMode = null;

        // 停止动画
        this.animationController.stop('talking');

        // 停止口型同步
        this.lipSyncEngine.stop();

        // 停止表情
        this.expressionManager.stopSpeakingMode();

        if (this.config.debug) {
            console.log('⏹ Speaking mode stopped');
        }
    }

    /**
     * 设置背景颜色
     */
    setBackgroundColor(color) {
        this.sceneManager.setBackgroundColor(color);
    }

    /**
     * 设置背景图片
     */
    async setBackgroundImage(imageUrl) {
        await this.sceneManager.setBackgroundImage(imageUrl);
    }

    /**
     * 清除背景图片
     */
    clearBackgroundImage() {
        this.sceneManager.clearBackgroundImage();
    }

    /**
     * 销毁实例
     */
    destroy() {
        if (this.isDestroyed) {
            return;
        }

        this.stopListening();
        this.stopSpeaking();

        if (this.sceneManager) {
            this.sceneManager.destroy();
        }

        if (this.expressionManager) {
            this.expressionManager.destroy();
        }

        if (this.lipSyncEngine) {
            this.lipSyncEngine.destroy();
        }

        this.isDestroyed = true;
        this.removeAllListeners();

        if (this.config.debug) {
            console.log('🗑️ DigitalHuman destroyed');
        }
    }
}
