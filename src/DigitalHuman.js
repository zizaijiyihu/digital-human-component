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
import { VideoAutoCaptureManager } from './modules/VideoAutoCaptureManager.js';

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

        // 视频通话模式相关
        this.isVideoCallMode = false;
        this.localMediaStream = null;
        this.localVideoElement = null;
        this.videoCallContainer = null;
        this.pipContainer = null;
        this.audioVisualizer = null;
        this.visualizerAnimationId = null;
        this.originalContainerStyle = null;

        // 事件监听器引用（用于后续移除）
        this.pipMouseEnterHandler = null;
        this.pipMouseLeaveHandler = null;
        this.pipClickHandler = null;
        this.cameraPipMouseEnterHandler = null;
        this.cameraPipMouseLeaveHandler = null;
        this.cameraPipClickHandler = null;

        // 视频自动采集相关
        this.videoAutoCaptureManager = null;
        this.isVideoAutoCaptureEnabled = false;

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

            // 保存实际的 DOM 元素，供后续方法使用（如视频通话模式）
            this.config.container = container;

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

        // 创建音频流队列（支持 PCM 自动转换）
        this.audioStreamQueue = new AudioStreamQueue(
            this.streamAudioContext,
            this.streamAnalyser,
            {
                autoPCMConvert: options.autoPCMConvert !== false,
                sampleRate: options.sampleRate || 16000,
                numChannels: options.numChannels || 1,
                bitDepth: options.bitDepth || 16
            }
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

        // 清理视频通话模式资源
        if (this.isVideoCallMode) {
            this.exitVideoCallMode();
        }

        this.isDestroyed = true;
        this.removeAllListeners();

        if (this.config.debug) {
            console.log('🗑️ DigitalHuman destroyed');
        }
    }

    /**
     * 进入视频通话模式
     * @param {Object} options - 配置选项
     * @param {string} options.pipPosition - PiP 窗口位置 ('bottom-right' | 'bottom-left' | 'top-right' | 'top-left')
     * @param {number} options.pipScale - PiP 缩放比例，默认 0.25 (1/4)
     * @param {boolean} options.showLocalVideo - 是否显示本地摄像头，默认 true
     * @param {boolean} options.showAudioVisualizer - 是否显示音频可视化，默认 true
     * @returns {Promise<MediaStream>} 本地媒体流
     */
    async enterVideoCallMode(options = {}) {
        if (this.isVideoCallMode) {
            console.warn('Already in video call mode');
            return this.localMediaStream;
        }

        const config = {
            pipPosition: options.pipPosition || 'bottom-right',
            pipScale: options.pipScale || 0.25,
            showLocalVideo: options.showLocalVideo !== false,
            showAudioVisualizer: options.showAudioVisualizer !== false
        };

        // 保存初始配置
        this.currentPipPosition = config.pipPosition;
        this.currentPipScale = config.pipScale;
        this.currentShowLocalVideo = config.showLocalVideo;
        this.currentShowAudioVisualizer = config.showAudioVisualizer;

        try {
            // 获取本地摄像头和麦克风
            this.localMediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // 创建视频通话布局
            this._createVideoCallLayout(config);

            // 设置本地视频流
            if (config.showLocalVideo && this.localVideoElement) {
                this.localVideoElement.srcObject = this.localMediaStream;
            }

            // 启动音频可视化
            if (config.showAudioVisualizer) {
                this._startAudioVisualizer();
            }

            this.isVideoCallMode = true;

            // 触发事件
            this.emit('videoCallEnter', { stream: this.localMediaStream });

            if (this.config.debug) {
                console.log('📹 Entered video call mode');
            }

            return this.localMediaStream;

        } catch (error) {
            console.error('Failed to enter video call mode:', error);
            this.emit('videoCallError', { error });
            throw error;
        }
    }

    /**
     * 退出视频通话模式
     */
    exitVideoCallMode() {
        if (!this.isVideoCallMode) {
            return;
        }

        // 停止视频自动采集（如果已启动）
        if (this.isVideoAutoCaptureEnabled) {
            this.disableVideoAutoCapture();
        }

        // 停止音频可视化
        if (this.visualizerAnimationId) {
            cancelAnimationFrame(this.visualizerAnimationId);
            this.visualizerAnimationId = null;
        }

        // 停止本地媒体流
        if (this.localMediaStream) {
            this.localMediaStream.getTracks().forEach(track => track.stop());
            this.localMediaStream = null;
        }

        // 移除视频通话布局
        this._removeVideoCallLayout();

        this.isVideoCallMode = false;

        // 触发事件
        this.emit('videoCallExit');

        if (this.config.debug) {
            console.log('📹 Exited video call mode');
        }
    }

    /**
     * 创建视频通话布局
     * @private
     */
    _createVideoCallLayout(config) {
        const container = this.config.container;

        // 确保容器是相对定位
        container.style.position = 'relative';

        // 判断当前模式
        const isCameraMainWindow = config.pipScale < 1.0; // 小窗口模式：摄像头主窗口
        const isDigitalHumanMainWindow = config.pipScale === 1.0; // 大窗口模式：数字人主窗口

        // 创建主窗口内容（根据模式决定是摄像头还是数字人）
        if (isCameraMainWindow) {
            // 摄像头主窗口模式：创建摄像头容器占据主窗口
            this.videoCallContainer = document.createElement('div');
            this.videoCallContainer.className = 'digital-human-video-call-container';
            this.videoCallContainer.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #000;
                z-index: 1;
                overflow: hidden;
            `;

            // 创建本地视频元素
            this.localVideoElement = document.createElement('video');
            this.localVideoElement.autoplay = true;
            this.localVideoElement.playsInline = true;
            this.localVideoElement.muted = true; // 本地视频静音避免回声
            this.localVideoElement.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
                transform: scaleX(-1); /* 镜像翻转，更自然 */
            `;

            this.videoCallContainer.appendChild(this.localVideoElement);

            // 创建音频可视化 canvas（仅在摄像头主窗口模式下）
            if (config.showAudioVisualizer) {
                this.audioVisualizer = document.createElement('canvas');
                this.audioVisualizer.className = 'audio-visualizer';
                this.audioVisualizer.style.cssText = `
                    position: absolute;
                    bottom: 30px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 120px;
                    height: 30px;
                    z-index: 10;
                    pointer-events: none;
                `;
                this.audioVisualizer.width = 120;
                this.audioVisualizer.height = 30;
                this.videoCallContainer.appendChild(this.audioVisualizer);
            }

            // 插入到容器开头
            container.insertBefore(this.videoCallContainer, container.firstChild);
        }

        // 找到数字人的 canvas 元素
        const digitalHumanCanvas = this.sceneManager.renderer.domElement;

        // 创建 PiP 容器（数字人或摄像头缩小到角落）
        this.pipContainer = document.createElement('div');
        this.pipContainer.className = 'digital-human-pip-container';

        // 计算 PiP 尺寸
        const pipWidth = container.offsetWidth * config.pipScale;
        const pipHeight = container.offsetHeight * config.pipScale;

        // 根据位置设置样式
        const positions = {
            'bottom-right': { bottom: '20px', right: '20px' },
            'bottom-left': { bottom: '20px', left: '20px' },
            'top-right': { top: '20px', right: '20px' },
            'top-left': { top: '20px', left: '20px' }
        };

        const posStyle = positions[config.pipPosition] || positions['bottom-right'];

        // 设置 PiP 容器样式（直角窗口）
        this.pipContainer.style.cssText = `
            position: absolute;
            ${posStyle.top ? `top: ${posStyle.top};` : ''}
            ${posStyle.bottom ? `bottom: ${posStyle.bottom};` : ''}
            ${posStyle.left ? `left: ${posStyle.left};` : ''}
            ${posStyle.right ? `right: ${posStyle.right};` : ''}
            width: ${pipWidth}px;
            height: ${pipHeight}px;
            border-radius: 0;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            z-index: 100;
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
            border: 3px solid rgba(255, 255, 255, 0.2);
        `;

        // 如果是全屏模式（数字人主窗口），创建摄像头小窗口
        if (isDigitalHumanMainWindow) {
            // 数字人占据主窗口，摄像头变成小窗口 - 重新设置完整样式
            this.pipContainer.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                border: none;
                box-shadow: none;
                border-radius: 0;
                overflow: hidden;
                z-index: 1;
                background: ${this.config.backgroundColor || '#1a1a2e'};
            `;

            // 创建摄像头小窗口（直角窗口）
            this.cameraPipContainer = document.createElement('div');
            this.cameraPipContainer.className = 'digital-human-camera-pip-container';
            this.cameraPipContainer.style.cssText = `
                position: absolute;
                ${posStyle.top ? `top: ${posStyle.top};` : ''}
                ${posStyle.bottom ? `bottom: ${posStyle.bottom};` : ''}
                ${posStyle.left ? `left: ${posStyle.left};` : ''}
                ${posStyle.right ? `right: ${posStyle.right};` : ''}
                width: ${pipWidth}px;
                height: ${pipHeight}px;
                border-radius: 0;
                overflow: hidden;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                z-index: 200;
                transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                cursor: pointer;
                border: 3px solid rgba(255, 255, 255, 0.2);
            `;

            // 创建本地视频元素（用于摄像头小窗口）
            this.cameraVideoElement = document.createElement('video');
            this.cameraVideoElement.autoplay = true;
            this.cameraVideoElement.playsInline = true;
            this.cameraVideoElement.muted = true;
            this.cameraVideoElement.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
                transform: scaleX(-1);
            `;

            this.cameraPipContainer.appendChild(this.cameraVideoElement);
            container.appendChild(this.cameraPipContainer);

            // 为摄像头小窗口添加悬停效果（保存引用以便后续移除）
            this.cameraPipMouseEnterHandler = () => {
                this.cameraPipContainer.style.transform = 'scale(1.05)';
                this.cameraPipContainer.style.borderColor = 'rgba(255, 255, 255, 0.5)';
            };

            this.cameraPipMouseLeaveHandler = () => {
                this.cameraPipContainer.style.transform = 'scale(1)';
                this.cameraPipContainer.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            };

            this.cameraPipClickHandler = async (event) => {
                event.stopPropagation();
                try {
                    await this.toggleWindowSize();
                } catch (error) {
                    console.error('Failed to toggle window size on camera click:', error);
                }
            };

            this.cameraPipContainer.addEventListener('mouseenter', this.cameraPipMouseEnterHandler);
            this.cameraPipContainer.addEventListener('mouseleave', this.cameraPipMouseLeaveHandler);
            this.cameraPipContainer.addEventListener('click', this.cameraPipClickHandler);
        }

        // 添加悬停效果（仅在小窗口模式下，保存引用以便后续移除）
        if (config.pipScale < 1.0) {
            this.pipMouseEnterHandler = () => {
                this.pipContainer.style.transform = 'scale(1.05)';
                this.pipContainer.style.borderColor = 'rgba(255, 255, 255, 0.5)';
            };

            this.pipMouseLeaveHandler = () => {
                this.pipContainer.style.transform = 'scale(1)';
                this.pipContainer.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            };

            this.pipClickHandler = async (event) => {
                event.stopPropagation();
                try {
                    await this.toggleWindowSize();
                } catch (error) {
                    console.error('Failed to toggle window size on click:', error);
                }
            };

            this.pipContainer.addEventListener('mouseenter', this.pipMouseEnterHandler);
            this.pipContainer.addEventListener('mouseleave', this.pipMouseLeaveHandler);
            this.pipContainer.addEventListener('click', this.pipClickHandler);
        }

        // 将数字人 canvas 移入 PiP 容器
        this.pipContainer.appendChild(digitalHumanCanvas);

        // 调整数字人 canvas 样式以适应 PiP 容器
        digitalHumanCanvas.style.width = '100%';
        digitalHumanCanvas.style.height = '100%';

        // 将 PiP 容器添加到主容器
        container.appendChild(this.pipContainer);

        // 调整 Three.js renderer 尺寸
        this.sceneManager.renderer.setSize(pipWidth, pipHeight);
        this.sceneManager.camera.aspect = pipWidth / pipHeight;
        this.sceneManager.camera.updateProjectionMatrix();
    }

    /**
     * 移除视频通话布局
     * @private
     */
    _removeVideoCallLayout() {
        const container = this.config.container;

        // 移除视频通话容器
        if (this.videoCallContainer && this.videoCallContainer.parentNode) {
            this.videoCallContainer.parentNode.removeChild(this.videoCallContainer);
            this.videoCallContainer = null;
        }

        // 移除摄像头小窗口
        if (this.cameraPipContainer && this.cameraPipContainer.parentNode) {
            this.cameraPipContainer.parentNode.removeChild(this.cameraPipContainer);
            this.cameraPipContainer = null;
        }

        // 找到数字人的 canvas
        const digitalHumanCanvas = this.sceneManager.renderer.domElement;

        // 从 PiP 容器中取出 canvas
        if (this.pipContainer && digitalHumanCanvas) {
            // 将 canvas 移回原始容器
            container.appendChild(digitalHumanCanvas);

            // 恢复 canvas 样式
            digitalHumanCanvas.style.width = '100%';
            digitalHumanCanvas.style.height = '100%';

            // 移除 PiP 容器
            if (this.pipContainer.parentNode) {
                this.pipContainer.parentNode.removeChild(this.pipContainer);
            }
            this.pipContainer = null;
        }

        // 恢复容器样式（重置为默认）
        container.style.position = '';

        // 恢复 Three.js renderer 尺寸
        const width = container.offsetWidth;
        const height = container.offsetHeight;
        this.sceneManager.renderer.setSize(width, height);
        this.sceneManager.camera.aspect = width / height;
        this.sceneManager.camera.updateProjectionMatrix();

        this.localVideoElement = null;
        this.audioVisualizer = null;
        this.cameraVideoElement = null;
    }

    /**
     * 平滑切换大小窗口（小窗口 ↔ 大窗口）
     * @param {Object} options - 切换配置
     * @param {string} [options.pipPosition='bottom-right'] - 小窗口位置
     * @param {number} [options.pipScale=0.25] - 小窗口缩放比例
     * @param {boolean} [options.showLocalVideo=true] - 是否显示本地视频
     * @param {boolean} [options.showAudioVisualizer=true] - 是否显示音频可视化器
     */
    async toggleWindowSize(options = {}) {
        if (!this.isVideoCallMode) {
            console.warn('Not in video call mode, cannot toggle window size');
            return;
        }

        const container = this.config.container;
        const isCurrentlySmallWindow = this.currentPipScale < 1.0;

        if (this.config.debug) {
            console.log(`📹 切换前状态: ${isCurrentlySmallWindow ? '摄像头主窗口，数字人小窗口' : '数字人主窗口，摄像头小窗口'}`);
        }

        try {
            const pipScale = options.pipScale || 0.25;
            const pipPosition = options.pipPosition || this.currentPipPosition || 'bottom-right';

            if (isCurrentlySmallWindow) {
                // ===== 从 "摄像头主窗口 + 数字人小窗口" 切换到 "数字人主窗口 + 摄像头小窗口" =====
                await this._toggleToDigitalHumanMain(pipPosition, pipScale, options);
            } else {
                // ===== 从 "数字人主窗口 + 摄像头小窗口" 切换到 "摄像头主窗口 + 数字人小窗口" =====
                await this._toggleToCameraMain(pipPosition, pipScale, options);
            }

            // 更新状态
            this.currentPipScale = isCurrentlySmallWindow ? 1.0 : pipScale;
            this.currentPipPosition = pipPosition;
            this.currentShowLocalVideo = options.showLocalVideo !== false;
            this.currentShowAudioVisualizer = options.showAudioVisualizer !== false;

            // 触发事件
            this.emit('windowSizeToggle', {
                isSmallWindow: this.currentPipScale < 1.0,
                config: {
                    pipPosition: this.currentPipPosition,
                    pipScale: this.currentPipScale,
                    showLocalVideo: this.currentShowLocalVideo,
                    showAudioVisualizer: this.currentShowAudioVisualizer
                }
            });

            if (this.config.debug) {
                console.log(`📹 切换后状态: ${this.currentPipScale < 1.0 ? '摄像头主窗口，数字人小窗口' : '数字人主窗口，摄像头小窗口'}`);
            }

        } catch (error) {
            console.error('Failed to toggle window size:', error);
            this.emit('windowSizeToggleError', { error });
            throw error;
        }
    }

    /**
     * 切换到数字人主窗口（数字人小窗口 → 铺满大窗口）
     * @private
     */
    async _toggleToDigitalHumanMain(pipPosition, pipScale, options) {
        const container = this.config.container;

        // 1. 停止音频可视化
        if (this.visualizerAnimationId) {
            cancelAnimationFrame(this.visualizerAnimationId);
            this.visualizerAnimationId = null;
        }

        // 2. 计算transform参数
        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;
        const pipWidth = containerWidth * pipScale;
        const pipHeight = containerHeight * pipScale;

        // 获取小窗口位置
        const positions = {
            'bottom-right': { bottom: 20, right: 20 },
            'bottom-left': { bottom: 20, left: 20 },
            'top-right': { top: 20, right: 20 },
            'top-left': { top: 20, left: 20 }
        };
        const pos = positions[pipPosition] || positions['bottom-right'];

        // 计算小窗口中心点相对于容器中心的偏移
        let smallWindowCenterX, smallWindowCenterY;
        if (pos.right !== undefined) {
            smallWindowCenterX = containerWidth - pos.right - pipWidth / 2;
        } else {
            smallWindowCenterX = pos.left + pipWidth / 2;
        }
        if (pos.bottom !== undefined) {
            smallWindowCenterY = containerHeight - pos.bottom - pipHeight / 2;
        } else {
            smallWindowCenterY = pos.top + pipHeight / 2;
        }

        const containerCenterX = containerWidth / 2;
        const containerCenterY = containerHeight / 2;

        const offsetX = containerCenterX - smallWindowCenterX;
        const offsetY = containerCenterY - smallWindowCenterY;

        // 3. 移除小窗口的hover事件
        if (this.pipContainer && this.pipMouseEnterHandler) {
            this.pipContainer.removeEventListener('mouseenter', this.pipMouseEnterHandler);
            this.pipContainer.removeEventListener('mouseleave', this.pipMouseLeaveHandler);
            this.pipContainer.removeEventListener('click', this.pipClickHandler);
            this.pipMouseEnterHandler = null;
            this.pipMouseLeaveHandler = null;
            this.pipClickHandler = null;
        }

        // 4. 设置数字人小窗口的 transform-origin (从当前位置开始缩放)
        this.pipContainer.style.transformOrigin = 'center center';

        // 5. 准备摄像头小窗口（先隐藏在底层）
        this.cameraPipContainer = document.createElement('div');
        this.cameraPipContainer.className = 'digital-human-camera-pip-container';
        const posStyle = positions[pipPosition] || positions['bottom-right'];
        this.cameraPipContainer.style.cssText = `
            position: absolute;
            ${posStyle.top !== undefined ? `top: ${posStyle.top}px;` : ''}
            ${posStyle.bottom !== undefined ? `bottom: ${posStyle.bottom}px;` : ''}
            ${posStyle.left !== undefined ? `left: ${posStyle.left}px;` : ''}
            ${posStyle.right !== undefined ? `right: ${posStyle.right}px;` : ''}
            width: ${pipWidth}px;
            height: ${pipHeight}px;
            border-radius: 0;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            z-index: 50;
            opacity: 0;
            transform: scale(0.8);
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
            border: 3px solid rgba(255, 255, 255, 0.2);
        `;

        this.cameraVideoElement = document.createElement('video');
        this.cameraVideoElement.autoplay = true;
        this.cameraVideoElement.playsInline = true;
        this.cameraVideoElement.muted = true;
        this.cameraVideoElement.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
            transform: scaleX(-1);
        `;
        this.cameraVideoElement.srcObject = this.localMediaStream;
        this.cameraPipContainer.appendChild(this.cameraVideoElement);
        container.appendChild(this.cameraPipContainer);

        // 6. 触发动画前强制reflow
        this.pipContainer.offsetHeight;

        // 7. 开始动画: 数字人小窗口铺满 + z-index提升
        this.pipContainer.style.zIndex = '200';  // 提升到最高层
        this.pipContainer.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';

        // 计算缩放比例 (从小窗口大小变为全屏)
        const scaleX = containerWidth / pipWidth;
        const scaleY = containerHeight / pipHeight;

        this.pipContainer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scaleX}, ${scaleY})`;

        // 同时让摄像头小窗口从底层淡入
        requestAnimationFrame(() => {
            this.cameraPipContainer.style.opacity = '1';
            this.cameraPipContainer.style.transform = 'scale(1)';
        });

        // 8. 等待动画完成
        await new Promise(resolve => setTimeout(resolve, 500));

        // 9. 移除摄像头主容器
        if (this.videoCallContainer && this.videoCallContainer.parentNode) {
            this.videoCallContainer.parentNode.removeChild(this.videoCallContainer);
            this.videoCallContainer = null;
            this.localVideoElement = null;
        }

        // 10. 重置数字人容器样式为全屏（移除transform）
        this.pipContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
            box-shadow: none;
            border-radius: 0;
            overflow: hidden;
            z-index: 1;
            cursor: default;
            background: ${this.config.backgroundColor || '#1a1a2e'};
        `;

        // 11. 调整数字人 canvas 尺寸
        const canvas = this.sceneManager.renderer.domElement;

        // 清除可能的 transform 残留
        canvas.style.transform = 'none';
        canvas.style.transformOrigin = '';

        // 设置 canvas 的 CSS 尺寸
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';

        // 更新渲染器和相机
        this.sceneManager.renderer.setSize(containerWidth, containerHeight);
        this.sceneManager.camera.aspect = containerWidth / containerHeight;
        this.sceneManager.camera.updateProjectionMatrix();

        // 更新 OrbitControls（如果存在）
        if (this.sceneManager.controls) {
            this.sceneManager.controls.update();
        }

        // 12. 重置摄像头小窗口z-index
        this.cameraPipContainer.style.zIndex = '200';

        // 13. 添加摄像头小窗口的事件监听
        this.cameraPipMouseEnterHandler = () => {
            this.cameraPipContainer.style.transform = 'scale(1.05)';
            this.cameraPipContainer.style.borderColor = 'rgba(255, 255, 255, 0.5)';
        };

        this.cameraPipMouseLeaveHandler = () => {
            this.cameraPipContainer.style.transform = 'scale(1)';
            this.cameraPipContainer.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        };

        this.cameraPipClickHandler = async (event) => {
            event.stopPropagation();
            await this.toggleWindowSize();
        };

        this.cameraPipContainer.addEventListener('mouseenter', this.cameraPipMouseEnterHandler);
        this.cameraPipContainer.addEventListener('mouseleave', this.cameraPipMouseLeaveHandler);
        this.cameraPipContainer.addEventListener('click', this.cameraPipClickHandler);
    }

    /**
     * 切换到摄像头主窗口（摄像头小窗口 → 铺满大窗口）
     * @private
     */
    async _toggleToCameraMain(pipPosition, pipScale, options) {
        const container = this.config.container;
        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;
        const pipWidth = containerWidth * pipScale;
        const pipHeight = containerHeight * pipScale;

        // 获取小窗口位置
        const positions = {
            'bottom-right': { bottom: 20, right: 20 },
            'bottom-left': { bottom: 20, left: 20 },
            'top-right': { top: 20, right: 20 },
            'top-left': { top: 20, left: 20 }
        };
        const pos = positions[pipPosition] || positions['bottom-right'];

        // 1. 移除摄像头小窗口的事件监听器
        if (this.cameraPipContainer && this.cameraPipMouseEnterHandler) {
            this.cameraPipContainer.removeEventListener('mouseenter', this.cameraPipMouseEnterHandler);
            this.cameraPipContainer.removeEventListener('mouseleave', this.cameraPipMouseLeaveHandler);
            this.cameraPipContainer.removeEventListener('click', this.cameraPipClickHandler);
            this.cameraPipMouseEnterHandler = null;
            this.cameraPipMouseLeaveHandler = null;
            this.cameraPipClickHandler = null;
        }

        // 2. 计算摄像头小窗口中心点相对于容器中心的偏移
        let smallWindowCenterX, smallWindowCenterY;
        if (pos.right !== undefined) {
            smallWindowCenterX = containerWidth - pos.right - pipWidth / 2;
        } else {
            smallWindowCenterX = pos.left + pipWidth / 2;
        }
        if (pos.bottom !== undefined) {
            smallWindowCenterY = containerHeight - pos.bottom - pipHeight / 2;
        } else {
            smallWindowCenterY = pos.top + pipHeight / 2;
        }

        const containerCenterX = containerWidth / 2;
        const containerCenterY = containerHeight / 2;

        const offsetX = containerCenterX - smallWindowCenterX;
        const offsetY = containerCenterY - smallWindowCenterY;

        // 3. 准备数字人小窗口（先隐藏）
        const posStyle = positions[pipPosition] || positions['bottom-right'];
        const tempPipContainer = document.createElement('div');
        tempPipContainer.className = 'digital-human-pip-temp';
        tempPipContainer.style.cssText = `
            position: absolute;
            ${posStyle.top !== undefined ? `top: ${posStyle.top}px;` : ''}
            ${posStyle.bottom !== undefined ? `bottom: ${posStyle.bottom}px;` : ''}
            ${posStyle.left !== undefined ? `left: ${posStyle.left}px;` : ''}
            ${posStyle.right !== undefined ? `right: ${posStyle.right}px;` : ''}
            width: ${pipWidth}px;
            height: ${pipHeight}px;
            border-radius: 0;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            z-index: 50;
            opacity: 0;
            transform: scale(0.8);
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
            border: 3px solid rgba(255, 255, 255, 0.2);
        `;
        container.appendChild(tempPipContainer);

        // 4. 触发reflow
        this.cameraPipContainer.offsetHeight;

        // 5. 开始动画: 摄像头小窗口铺满 + z-index提升
        this.cameraPipContainer.style.zIndex = '200';
        this.cameraPipContainer.style.transformOrigin = 'center center';
        this.cameraPipContainer.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';

        const scaleX = containerWidth / pipWidth;
        const scaleY = containerHeight / pipHeight;

        this.cameraPipContainer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scaleX}, ${scaleY})`;

        // 同时让数字人小窗口从底层淡入
        requestAnimationFrame(() => {
            tempPipContainer.style.opacity = '1';
            tempPipContainer.style.transform = 'scale(1)';
        });

        // 6. 等待动画完成
        await new Promise(resolve => setTimeout(resolve, 500));

        // 7. 删除摄像头小窗口
        if (this.cameraPipContainer && this.cameraPipContainer.parentNode) {
            this.cameraPipContainer.parentNode.removeChild(this.cameraPipContainer);
            this.cameraPipContainer = null;
            this.cameraVideoElement = null;
        }

        // 8. 创建真正的摄像头主容器
        this.videoCallContainer = document.createElement('div');
        this.videoCallContainer.className = 'digital-human-video-call-container';
        this.videoCallContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #000;
            z-index: 1;
            overflow: hidden;
        `;

        this.localVideoElement = document.createElement('video');
        this.localVideoElement.autoplay = true;
        this.localVideoElement.playsInline = true;
        this.localVideoElement.muted = true;
        this.localVideoElement.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
            transform: scaleX(-1);
        `;
        this.localVideoElement.srcObject = this.localMediaStream;
        this.videoCallContainer.appendChild(this.localVideoElement);

        // 添加音频可视化
        if (options.showAudioVisualizer !== false) {
            this.audioVisualizer = document.createElement('canvas');
            this.audioVisualizer.className = 'audio-visualizer';
            this.audioVisualizer.style.cssText = `
                position: absolute;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%);
                width: 120px;
                height: 30px;
                z-index: 10;
                pointer-events: none;
            `;
            this.audioVisualizer.width = 120;
            this.audioVisualizer.height = 30;
            this.videoCallContainer.appendChild(this.audioVisualizer);
        }

        container.insertBefore(this.videoCallContainer, container.firstChild);

        // 9. 将数字人容器移动到小窗口位置（用temp容器替换）
        const digitalHumanCanvas = this.sceneManager.renderer.domElement;
        tempPipContainer.appendChild(digitalHumanCanvas);
        this.pipContainer.parentNode.removeChild(this.pipContainer);
        this.pipContainer = tempPipContainer;
        this.pipContainer.className = 'digital-human-pip-container';
        this.pipContainer.style.opacity = '1';
        this.pipContainer.style.transform = 'scale(1)';
        this.pipContainer.style.zIndex = '100';

        // 10. 调整数字人 canvas 尺寸
        const canvas = this.sceneManager.renderer.domElement;

        // 清除可能的 transform 残留
        canvas.style.transform = 'none';
        canvas.style.transformOrigin = '';

        // 设置 canvas 的 CSS 尺寸
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';

        // 更新渲染器和相机
        this.sceneManager.renderer.setSize(pipWidth, pipHeight);
        this.sceneManager.camera.aspect = pipWidth / pipHeight;
        this.sceneManager.camera.updateProjectionMatrix();

        // 更新 OrbitControls（如果存在）
        if (this.sceneManager.controls) {
            this.sceneManager.controls.update();
        }

        // 11. 添加数字人小窗口的事件监听
        this.pipMouseEnterHandler = () => {
            this.pipContainer.style.transform = 'scale(1.05)';
            this.pipContainer.style.borderColor = 'rgba(255, 255, 255, 0.5)';
        };

        this.pipMouseLeaveHandler = () => {
            this.pipContainer.style.transform = 'scale(1)';
            this.pipContainer.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        };

        this.pipClickHandler = async (event) => {
            event.stopPropagation();
            await this.toggleWindowSize();
        };

        this.pipContainer.addEventListener('mouseenter', this.pipMouseEnterHandler);
        this.pipContainer.addEventListener('mouseleave', this.pipMouseLeaveHandler);
        this.pipContainer.addEventListener('click', this.pipClickHandler);

        // 12. 重新启动音频可视化
        if (options.showAudioVisualizer !== false) {
            this._startAudioVisualizer();
        }
    }

    /**
     * 启动音频可视化
     * @private
     */
    _startAudioVisualizer() {
        if (!this.localMediaStream || !this.audioVisualizer) {
            return;
        }

        // 创建音频上下文
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512; // 增加 FFT 大小以获得更平滑的频率数据
        analyser.smoothingTimeConstant = 0.85; // 增加平滑系数

        const source = audioContext.createMediaStreamSource(this.localMediaStream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const canvas = this.audioVisualizer;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // 用于平滑音频数据的历史缓冲
        let prevAmplitude = 0;

        // Catmull-Rom 样条插值函数（获得更平滑的曲线）
        const catmullRomSpline = (p0, p1, p2, p3, t) => {
            const v0 = (p2 - p0) * 0.5;
            const v1 = (p3 - p1) * 0.5;
            const t2 = t * t;
            const t3 = t * t2;
            return (2 * p1 - 2 * p2 + v0 + v1) * t3 +
                   (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 +
                   v0 * t + p1;
        };

        const draw = () => {
            this.visualizerAnimationId = requestAnimationFrame(draw);

            analyser.getByteFrequencyData(dataArray);

            // 清空画布（完全透明）
            ctx.clearRect(0, 0, width, height);

            // 计算平均音量并平滑
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;
            const targetAmplitude = (average / 255) * (height / 2) * 2.1;

            // 使用插值平滑幅度变化
            prevAmplitude += (targetAmplitude - prevAmplitude) * 0.15;
            const amplitude = prevAmplitude;

            // 绘制第一条波浪线
            ctx.beginPath();
            ctx.lineWidth = 2.5;

            // 根据录制状态选择颜色
            const isRecording = canvas.dataset.recording === 'true';
            const gradient = ctx.createLinearGradient(0, 0, width, 0);

            if (isRecording) {
                // 录制时：绿色渐变
                gradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)');   // 浅绿
                gradient.addColorStop(0.5, 'rgba(22, 163, 74, 0.7)'); // 中绿
                gradient.addColorStop(1, 'rgba(34, 197, 94, 0.3)');   // 浅绿
            } else {
                // 正常时：蓝色渐变
                gradient.addColorStop(0, 'rgba(135, 206, 250, 0.3)');
                gradient.addColorStop(0.5, 'rgba(100, 149, 237, 0.7)');
                gradient.addColorStop(1, 'rgba(135, 206, 250, 0.3)');
            }

            ctx.strokeStyle = gradient;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // 绘制平滑的波浪曲线
            const points = 60; // 减少采样点，但使用样条插值
            const step = width / points;
            const centerY = height / 2;

            // 生成关键点
            const keyPoints = [];
            for (let i = 0; i <= points; i++) {
                const x = i * step;
                const audioIndex = Math.floor((i / points) * bufferLength);
                const audioValue = dataArray[audioIndex] / 255;

                // 计算中心到边缘的衰减系数
                const distanceFromCenter = Math.abs(i / points - 0.5) * 2;
                const fadeOut = 1 - distanceFromCenter;
                const smoothFade = Math.pow(fadeOut, 2.5);

                // 使用正弦波创建平滑效果
                const wave = Math.sin((i / points) * Math.PI * 4 + Date.now() / 300) * amplitude * 0.7 * smoothFade;
                const y = centerY + wave + (audioValue * amplitude * 1.7 * smoothFade);

                keyPoints.push({ x, y });
            }

            // 使用 Catmull-Rom 样条插值绘制超平滑曲线
            ctx.moveTo(keyPoints[0].x, keyPoints[0].y);

            for (let i = 0; i < keyPoints.length - 1; i++) {
                const p0 = keyPoints[Math.max(0, i - 1)];
                const p1 = keyPoints[i];
                const p2 = keyPoints[i + 1];
                const p3 = keyPoints[Math.min(keyPoints.length - 1, i + 2)];

                // 在每两个关键点之间插入多个点
                const segments = 10;
                for (let j = 1; j <= segments; j++) {
                    const t = j / segments;
                    const x = p1.x + (p2.x - p1.x) * t;
                    const y = catmullRomSpline(p0.y, p1.y, p2.y, p3.y, t);
                    ctx.lineTo(x, y);
                }
            }

            ctx.stroke();

            // 绘制第二条波浪线（增加层次感）
            ctx.beginPath();
            ctx.lineWidth = 2;

            const gradient2 = ctx.createLinearGradient(0, 0, width, 0);
            gradient2.addColorStop(0, 'rgba(173, 216, 230, 0.2)');
            gradient2.addColorStop(0.5, 'rgba(135, 206, 250, 0.5)');
            gradient2.addColorStop(1, 'rgba(173, 216, 230, 0.2)');

            ctx.strokeStyle = gradient2;

            // 生成第二条波浪线的关键点
            const keyPoints2 = [];
            for (let i = 0; i <= points; i++) {
                const x = i * step;
                const audioIndex = Math.floor((i / points) * bufferLength);
                const audioValue = dataArray[audioIndex] / 255;

                const distanceFromCenter = Math.abs(i / points - 0.5) * 2;
                const fadeOut = 1 - distanceFromCenter;
                const smoothFade = Math.pow(fadeOut, 2.5);

                const wave = Math.sin((i / points) * Math.PI * 4 + Date.now() / 200) * amplitude * 0.6 * smoothFade;
                const y = centerY - wave - (audioValue * amplitude * 1.4 * smoothFade);

                keyPoints2.push({ x, y });
            }

            ctx.moveTo(keyPoints2[0].x, keyPoints2[0].y);

            for (let i = 0; i < keyPoints2.length - 1; i++) {
                const p0 = keyPoints2[Math.max(0, i - 1)];
                const p1 = keyPoints2[i];
                const p2 = keyPoints2[i + 1];
                const p3 = keyPoints2[Math.min(keyPoints2.length - 1, i + 2)];

                const segments = 10;
                for (let j = 1; j <= segments; j++) {
                    const t = j / segments;
                    const x = p1.x + (p2.x - p1.x) * t;
                    const y = catmullRomSpline(p0.y, p1.y, p2.y, p3.y, t);
                    ctx.lineTo(x, y);
                }
            }

            ctx.stroke();
        };

        draw();
    }

    /**
     * 启动视频自动采集（分组录制架构）
     * @param {Object} options - 配置选项
     * @param {Function} options.onVideoCapture - 视频捕获回调 (videoGroups) => {}
     *   - videoGroups: 视频组数组 [{ blob, duration, startTime, endTime, size, type }, ...]
     *   - type: 'before-speaking' (说话前的 N 组) 或 'speaking' (说话期间的 1 组)
     * @param {number} [options.maxGroups=1] - 保留的视频组数量（默认 1 组）
     * @param {number} [options.groupDuration=5000] - 每组视频时长（默认 5000ms = 5 秒）
     * @param {number} [options.speechThreshold=40] - 说话检测阈值
     * @param {number} [options.silenceDuration=2000] - 静音持续时间（毫秒）
     * @param {number} [options.minSpeakDuration=500] - 最小说话时长（毫秒）
     * @param {number} [options.maxRecordDuration=300000] - 最大录制时长（毫秒，默认 5 分钟）
     * @param {string} [options.videoFormat='video/webm'] - 视频格式
     * @param {number} [options.videoBitsPerSecond=2500000] - 视频比特率
     * @param {Function} [options.onSpeakingStart] - 说话开始回调
     * @param {Function} [options.onSpeakingEnd] - 说话结束回调
     * @param {Function} [options.onError] - 错误回调
     */
    async enableVideoAutoCapture(options = {}) {
        // 必须在视频通话模式下才能使用
        if (!this.isVideoCallMode) {
            const error = new Error('Video auto capture is only available in video call mode');
            console.error(error.message);
            if (options.onError) {
                options.onError(error);
            }
            throw error;
        }

        // 已经启动
        if (this.isVideoAutoCaptureEnabled) {
            console.warn('Video auto capture already enabled');
            return;
        }

        // 验证必选参数
        if (!options.onVideoCapture || typeof options.onVideoCapture !== 'function') {
            throw new Error('onVideoCapture callback is required');
        }

        try {
            // 创建视频自动采集管理器
            this.videoAutoCaptureManager = new VideoAutoCaptureManager(this.localMediaStream, options);

            // 启动采集
            await this.videoAutoCaptureManager.start();

            this.isVideoAutoCaptureEnabled = true;

            // 触发事件
            this.emit('videoAutoCaptureEnabled');

            if (this.config.debug) {
                console.log('📹 Video auto capture enabled');
            }

        } catch (error) {
            console.error('Failed to enable video auto capture:', error);
            this.emit('videoAutoCaptureError', { error });
            if (options.onError) {
                options.onError(error);
            }
            throw error;
        }
    }

    /**
     * 停止视频自动采集
     */
    disableVideoAutoCapture() {
        if (!this.isVideoAutoCaptureEnabled) {
            console.warn('Video auto capture is not enabled');
            return;
        }

        // 停止采集
        if (this.videoAutoCaptureManager) {
            this.videoAutoCaptureManager.destroy();
            this.videoAutoCaptureManager = null;
        }

        this.isVideoAutoCaptureEnabled = false;

        // 触发事件
        this.emit('videoAutoCaptureDisabled');

        if (this.config.debug) {
            console.log('📹 Video auto capture disabled');
        }
    }

    /**
     * 获取视频自动采集状态
     * @returns {Object|null} 状态对象或 null
     */
    getVideoAutoCaptureStatus() {
        if (!this.videoAutoCaptureManager) {
            return null;
        }

        return this.videoAutoCaptureManager.getStatus();
    }

    /**
     * 获取所有视频组（随时调用）
     * @returns {Array} 视频组数组 [{ blob, duration, startTime, endTime, size, isRecording }, ...]
     */
    getAllVideoGroups() {
        if (!this.videoAutoCaptureManager) {
            return [];
        }

        return this.videoAutoCaptureManager.getAllVideoGroups();
    }
}
