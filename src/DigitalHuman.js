import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEFAULT_CONFIG } from './config/defaults.js';
import { SceneManager } from './modules/SceneManager.js';
import { AnimationController } from './modules/AnimationController.js';
import { LipSyncEngine } from './modules/LipSyncEngine.js';
import { ExpressionManager } from './modules/ExpressionManager.js';
import { EventEmitter } from './utils/EventEmitter.js';
import { AudioStreamQueue } from './modules/AudioStreamQueue.js';

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
            modelUrl: options.modelUrl || DEFAULT_CONFIG.DEFAULT_MODEL_URL,

            // 动画配置
            useDefaultAnimations: options.useDefaultAnimations !== false,
            animations: {
                idle: options.animations?.idle || null,
                talking: options.animations?.talking || null
            },

            // 背景配置
            backgroundColor: options.backgroundColor || '#1a1a2e',
            backgroundImage: options.backgroundImage !== undefined
                ? options.backgroundImage
                : DEFAULT_CONFIG.DEFAULT_BACKGROUND_IMAGE,
            useDefaultBackground: options.backgroundImage !== undefined ? false : true,

            // 尺寸（不设置默认值，让 SceneManager 根据容器实际尺寸决定）
            width: options.width,
            height: options.height,

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
            onLoadingStart: options.onLoadingStart || null,
            onError: options.onError || null,

            // 加载动画
            showLoading: options.showLoading !== false,  // 默认显示

            // 调试
            showControls: options.showControls || false,
            enableOrbitControls: options.enableOrbitControls === true,  // 默认禁用，固定视角
            debug: options.debug || false
        };

        // 验证必选参数
        if (!this.config.container) {
            throw new Error('DigitalHuman: container is required');
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

        // 流式音频相关
        this.audioStreamQueue = null;
        this.streamAudioContext = null;
        this.streamAnalyser = null;

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

            // 显示加载动画
            if (this.config.showLoading) {
                this.sceneManager.showLoading();
            }

            // 触发加载开始回调
            if (this.config.onLoadingStart) {
                this.config.onLoadingStart();
            }

            // 2. 加载模型
            await this._loadModel();

            // 3. 初始化子模块
            this.animationController = new AnimationController(this.avatar, this.sceneManager.mixer);
            // 将 AnimationController 创建的 mixer 回传给 SceneManager
            this.sceneManager.mixer = this.animationController.mixer;

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
                try {
                    await this.setBackgroundImage(this.config.backgroundImage);
                } catch (error) {
                    console.warn('Failed to load background image, using background color instead:', error);
                    // 继续初始化，只是没有背景图片
                }
            }

            // 6. 标记为就绪
            this.isReady = true;

            // 隐藏加载动画
            if (this.config.showLoading) {
                this.sceneManager.hideLoading();
            }

            this.emit('ready');
            if (this.config.onReady) {
                this.config.onReady();
            }

            // 7. 自动启动模式（必须在 isReady = true 之后）
            if (this.config.autoStart === 'listening') {
                this.startListening();
            } else if (this.config.autoStart === 'speaking') {
                // 说话模式需要音频，不自动启动
                console.warn('DigitalHuman: autoStart "speaking" requires audio, skipping');
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

        // 停止流式音频队列（如果有）
        if (this.audioStreamQueue) {
            this.audioStreamQueue.stop();
            this.audioStreamQueue = null;
        }

        if (this.config.debug) {
            console.log('⏹ Speaking mode stopped');
        }
    }

    /**
     * 流式说话（支持实时音频流）
     * @param {Object} options - 配置选项
     * @param {AsyncGenerator<ArrayBuffer>|Function} options.audioStream - 音频流生成器或回调函数
     * @param {string} [options.sampleRate=16000] - 音频采样率
     * @param {Function} [options.onChunkReceived] - 收到音频片段时的回调
     * @param {Function} [options.onStreamEnd] - 流结束时的回调
     * @returns {Object} 控制对象 { stop, isPlaying }
     */
    async speakStreaming(options) {
        if (!this.isReady) {
            console.warn('DigitalHuman: not ready yet');
            return null;
        }

        if (!options || !options.audioStream) {
            throw new Error('audioStream is required for streaming mode');
        }

        // 停止聆听模式
        if (this.currentMode === 'listening') {
            this.stopListening();
        }

        // 停止之前的说话模式
        if (this.currentMode === 'speaking') {
            this.stopSpeaking();
        }

        this.currentMode = 'speaking';

        // 播放说话动画
        this.animationController.play('talking');

        // 启动说话时的眨眼
        this.expressionManager.startSpeakingMode();

        // 初始化流式音频上下文
        if (!this.streamAudioContext) {
            this.streamAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.streamAnalyser = this.streamAudioContext.createAnalyser();
            this.streamAnalyser.fftSize = DEFAULT_CONFIG.LIP_SYNC.fftSize;
            this.streamAnalyser.connect(this.streamAudioContext.destination);
        }

        if (this.streamAudioContext.state === 'suspended') {
            await this.streamAudioContext.resume();
        }

        // 创建音频流队列
        this.audioStreamQueue = new AudioStreamQueue(
            this.streamAudioContext,
            this.streamAnalyser
        );

        // 设置队列事件
        this.audioStreamQueue.onStart = () => {
            // 启动流式口型同步
            this.lipSyncEngine.startStreaming(this.streamAnalyser, this.streamAudioContext);

            this.emit('speakStart', { streaming: true });
            if (this.config.onSpeakStart) {
                this.config.onSpeakStart({ streaming: true });
            }

            if (this.config.debug) {
                console.log('🗣️ Streaming speaking mode started');
            }
        };

        this.audioStreamQueue.onEnd = () => {
            this.lipSyncEngine.stop();
            this.currentMode = null;

            this.emit('speakEnd');
            if (this.config.onSpeakEnd) {
                this.config.onSpeakEnd();
            }

            if (options.onStreamEnd) {
                options.onStreamEnd();
            }

            if (this.config.debug) {
                console.log('✅ Streaming speaking mode ended');
            }
        };

        this.audioStreamQueue.onError = (error) => {
            console.error('AudioStreamQueue error:', error);
            this.emit('error', error);
            if (this.config.onError) {
                this.config.onError(error);
            }
        };

        // 处理音频流
        const { audioStream } = options;

        // 启动音频流处理
        (async () => {
            try {
                // 如果是异步生成器
                if (typeof audioStream === 'function' || audioStream[Symbol.asyncIterator]) {
                    const stream = typeof audioStream === 'function' ? audioStream() : audioStream;

                    for await (const audioChunk of stream) {
                        if (!this.audioStreamQueue) {
                            // 已停止
                            break;
                        }

                        await this.audioStreamQueue.enqueue(audioChunk);

                        if (options.onChunkReceived) {
                            options.onChunkReceived(audioChunk);
                        }
                    }
                }

                // 标记流结束
                if (this.audioStreamQueue) {
                    this.audioStreamQueue.finalize();
                }

            } catch (error) {
                console.error('Error processing audio stream:', error);
                this.emit('error', error);
                if (this.config.onError) {
                    this.config.onError(error);
                }
            }
        })();

        // 返回控制对象
        return {
            stop: () => {
                this.stopSpeaking();
            },
            isPlaying: () => {
                return this.currentMode === 'speaking';
            },
            enqueueAudio: async (audioChunk) => {
                if (this.audioStreamQueue) {
                    await this.audioStreamQueue.enqueue(audioChunk);
                }
            }
        };
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

        // 清理流式音频资源
        if (this.audioStreamQueue) {
            this.audioStreamQueue.destroy();
            this.audioStreamQueue = null;
        }

        if (this.streamAudioContext) {
            this.streamAudioContext.close();
            this.streamAudioContext = null;
        }

        this.streamAnalyser = null;

        this.isDestroyed = true;
        this.removeAllListeners();

        if (this.config.debug) {
            console.log('🗑️ DigitalHuman destroyed');
        }
    }
}
