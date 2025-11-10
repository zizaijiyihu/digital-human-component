(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('three'), require('three/addons/loaders/GLTFLoader.js'), require('three/addons/controls/OrbitControls.js')) :
    typeof define === 'function' && define.amd ? define(['exports', 'three', 'three/addons/loaders/GLTFLoader.js', 'three/addons/controls/OrbitControls.js'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.DigitalHuman = {}, global.THREE, global.THREE, global.THREE));
})(this, (function (exports, THREE, GLTFLoader_js, OrbitControls_js) { 'use strict';

    function _interopNamespaceDefault(e) {
        var n = Object.create(null);
        if (e) {
            Object.keys(e).forEach(function (k) {
                if (k !== 'default') {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () { return e[k]; }
                    });
                }
            });
        }
        n.default = e;
        return Object.freeze(n);
    }

    var THREE__namespace = /*#__PURE__*/_interopNamespaceDefault(THREE);

    /**
     * 默认配置
     */
    const DEFAULT_CONFIG = {
        // CDN 版本号（latest 指向最新的 Git 标签）
        CDN_VERSION: 'latest',

        // CDN 基础地址
        get CDN_BASE() {
            return `https://cdn.jsdelivr.net/gh/zizaijiyihu/digital-human-component@${this.CDN_VERSION}/cdn`;
        },

        // 默认模型 URL
        DEFAULT_MODEL_URL: 'https://models.readyplayer.me/690abee256dbb2e94779a60a.glb',

        // 默认动画
        get DEFAULT_ANIMATIONS() {
            return {
                idle: `${this.CDN_BASE}/animations/F_Standing_Idle_001.glb`,
                talking: `${this.CDN_BASE}/animations/F_Talking_Variations_005.glb`
            };
        },

        // 默认背景图片（优化后的 JPEG 格式，371KB）
        get DEFAULT_BACKGROUND_IMAGE() {
            return `${this.CDN_BASE}/images/office-background.jpg`;
        },

        // 音素映射表（Oculus ARKit 标准）
        PHONEME_TO_VISEME: {
            'aa': 'viseme_aa',
            'E': 'viseme_E',
            'I': 'viseme_I',
            'O': 'viseme_O',
            'U': 'viseme_U',
            'PP': 'viseme_PP',
            'FF': 'viseme_FF',
            'TH': 'viseme_TH',
            'DD': 'viseme_DD',
            'kk': 'viseme_kk',
            'CH': 'viseme_CH',
            'SS': 'viseme_SS',
            'nn': 'viseme_nn',
            'RR': 'viseme_RR',
            'sil': 'viseme_sil'
        },

        // 默认相机配置
        CAMERA: {
            fov: 45,
            aspect: 1,
            near: 0.1,
            far: 1000,
            position: { x: 0, y: 1.6, z: 0.7 },
            target: { x: 0, y: 1.5, z: 0 }
        },

        // 默认灯光配置
        LIGHTS: {
            ambient: { color: 0xffffff, intensity: 1.0 },  // 提高环境光，整体更亮
            key: { color: 0xffffff, intensity: 1.2, position: { x: 0, y: 2, z: 1 } },  // 提高主光源
            fill: { color: 0xffffff, intensity: 0.6, position: { x: 0, y: 1.6, z: 0.8 } },  // 提高补光，照亮脸部阴影
            rim: { color: 0xaaccff, intensity: 0.4, position: { x: 0, y: 1.8, z: -0.5 } }  // 轮廓光稍微提高
        },

        // 表情参数
        EXPRESSIONS: {
            blink: {
                duration: 80,
                intensity: 1.0
            },
            smile: {
                fadeIn: 500,
                hold: { min: 3000, max: 5000 },
                fadeOut: 800,
                intensity: 0.35
            },
            nod: {
                duration: 300,
                intensity: 0.1
            },
            browRaise: {
                duration: 200,
                hold: 400,
                intensity: 0.3
            },
            headTilt: {
                duration: 600,
                hold: 1500,
                intensity: 0.08
            }
        },

        // 表情频率（聆听模式）
        EXPRESSION_FREQUENCY: {
            blink: { min: 2000, max: 5000 },
            smile: { min: 8000, max: 15000 },
            nod: { min: 10000, max: 20000 },
            browRaise: { min: 6000, max: 12000 },
            headTilt: { min: 15000, max: 25000 }
        },

        // 口型同步配置
        LIP_SYNC: {
            fftSize: 512,
            speechRate: 3.5,              // 每秒 3.5 个字
            syllableDuration: 286,        // 毫秒
            closeRatio: 0.2,              // 闭合时长占比
            decayRate: {
                normal: 0.85,
                silence: 0.5,
                closing: 0.3
            }
        }
    };

    /**
     * 场景管理器
     */
    class SceneManager {
        constructor(container, config = {}) {
            this.container = container;
            this.config = config;

            // Three.js 核心对象
            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.controls = null;
            this.mixer = null;
            this.clock = null;

            // 背景
            this.backgroundTexture = null;

            // 动画循环
            this.animationId = null;

            // 加载动画元素
            this.loadingElement = null;

            this._init();
        }

        /**
         * 初始化场景
         */
        _init() {
            // 创建场景
            this.scene = new THREE__namespace.Scene();
            this.scene.background = new THREE__namespace.Color(this.config.backgroundColor || '#1a1a2e');

            // 创建相机（默认使用容器实际尺寸，避免拉伸）
            const width = this.config.width || this.container.clientWidth || 600;
            const height = this.config.height || this.container.clientHeight || 600;

            console.log('📐 SceneManager initialized with size:', {
                width,
                height,
                aspectRatio: (width / height).toFixed(2),
                containerSize: `${this.container.clientWidth}x${this.container.clientHeight}`
            });

            this.camera = new THREE__namespace.PerspectiveCamera(
                DEFAULT_CONFIG.CAMERA.fov,
                width / height,
                DEFAULT_CONFIG.CAMERA.near,
                DEFAULT_CONFIG.CAMERA.far
            );

            const camPos = this.config.cameraPosition || DEFAULT_CONFIG.CAMERA.position;
            this.camera.position.set(camPos.x, camPos.y, camPos.z);

            // 确保容器是相对定位，这样加载动画才能正确定位
            if (getComputedStyle(this.container).position === 'static') {
                this.container.style.position = 'relative';
            }

            // 创建渲染器
            this.renderer = new THREE__namespace.WebGLRenderer({ antialias: true });
            this.renderer.setSize(width, height);
            this.renderer.shadowMap.enabled = true;

            // 初始时设置 canvas 为透明，等加载完成后淡入
            this.renderer.domElement.style.opacity = '0';
            this.renderer.domElement.style.transition = 'opacity 0.8s ease-in';
            this.renderer.domElement.style.display = 'block';

            this.container.appendChild(this.renderer.domElement);

            // 创建控制器（默认禁用，固定视角）
            if (this.config.enableOrbitControls === true) {
                this.controls = new OrbitControls_js.OrbitControls(this.camera, this.renderer.domElement);
                const camTarget = this.config.cameraTarget || DEFAULT_CONFIG.CAMERA.target;
                this.controls.target.set(camTarget.x, camTarget.y, camTarget.z);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.05;
                this.controls.minDistance = 0.5;
                this.controls.maxDistance = 1.5;
                this.controls.update();
            }

            // 创建灯光
            this._setupLights();

            // 创建动画混合器（空的，等模型加载后使用）
            this.clock = new THREE__namespace.Clock();

            // 启动渲染循环
            this._startRenderLoop();

            // 响应窗口大小变化
            window.addEventListener('resize', () => this._onWindowResize());
        }

        /**
         * 设置灯光
         */
        _setupLights() {
            const lights = DEFAULT_CONFIG.LIGHTS;

            // 环境光
            const ambientLight = new THREE__namespace.AmbientLight(lights.ambient.color, lights.ambient.intensity);
            this.scene.add(ambientLight);

            // 主光源
            const keyLight = new THREE__namespace.DirectionalLight(lights.key.color, lights.key.intensity);
            keyLight.position.set(lights.key.position.x, lights.key.position.y, lights.key.position.z);
            this.scene.add(keyLight);

            // 补光
            const fillLight = new THREE__namespace.DirectionalLight(lights.fill.color, lights.fill.intensity);
            fillLight.position.set(lights.fill.position.x, lights.fill.position.y, lights.fill.position.z);
            this.scene.add(fillLight);

            // 轮廓光
            const rimLight = new THREE__namespace.DirectionalLight(lights.rim.color, lights.rim.intensity);
            rimLight.position.set(lights.rim.position.x, lights.rim.position.y, lights.rim.position.z);
            this.scene.add(rimLight);
        }

        /**
         * 启动渲染循环
         */
        _startRenderLoop() {
            const animate = () => {
                this.animationId = requestAnimationFrame(animate);

                const delta = this.clock.getDelta();

                // 更新动画混合器
                if (this.mixer) {
                    this.mixer.update(delta);
                }

                // 更新控制器
                if (this.controls) {
                    this.controls.update();
                }

                // 渲染
                this.renderer.render(this.scene, this.camera);
            };

            animate();
        }

        /**
         * 窗口大小改变
         */
        _onWindowResize() {
            const width = this.container.clientWidth;
            const height = this.container.clientHeight;

            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }

        /**
         * 设置背景颜色
         */
        setBackgroundColor(color) {
            this.scene.background = new THREE__namespace.Color(color);
        }

        /**
         * 设置背景图片
         */
        async setBackgroundImage(imageUrl) {
            return new Promise((resolve, reject) => {
                const textureLoader = new THREE__namespace.TextureLoader();
                textureLoader.load(
                    imageUrl,
                    (texture) => {
                        // 清理旧纹理
                        if (this.backgroundTexture) {
                            this.backgroundTexture.dispose();
                        }

                        // 计算纹理偏移和缩放，使图片高度填满，宽度居中
                        const imgAspect = texture.image.width / texture.image.height;
                        const canvasAspect = 1; // 正方形画布

                        if (imgAspect > canvasAspect) {
                            // 图片更宽，需要裁剪左右两边
                            const scale = canvasAspect / imgAspect;
                            texture.repeat.set(scale, 1);
                            texture.offset.set((1 - scale) / 2, 0); // 居中
                        } else {
                            // 图片更窄或等比，需要裁剪上下
                            const scale = imgAspect / canvasAspect;
                            texture.repeat.set(1, scale);
                            texture.offset.set(0, (1 - scale) / 2); // 居中
                        }

                        this.scene.background = texture;
                        this.backgroundTexture = texture;
                        resolve();
                    },
                    undefined,
                    reject
                );
            });
        }

        /**
         * 清除背景图片
         */
        clearBackgroundImage() {
            if (this.backgroundTexture) {
                this.backgroundTexture.dispose();
                this.backgroundTexture = null;
            }
            this.scene.background = new THREE__namespace.Color(this.config.backgroundColor || '#1a1a2e');
        }

        /**
         * 显示加载动画（视频通话连接风格）
         */
        showLoading() {
            if (this.loadingElement) return;

            // 创建加载容器
            this.loadingElement = document.createElement('div');
            this.loadingElement.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            z-index: 1000;
        `;

            // 创建头像占位符（模拟通话对象）
            const avatar = document.createElement('div');
            avatar.style.cssText = `
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 30px;
            box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
            position: relative;
        `;

            // 头像内的图标
            const avatarIcon = document.createElement('div');
            avatarIcon.innerHTML = `
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none">
                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="white"/>
            </svg>
        `;
            avatar.appendChild(avatarIcon);

            // 创建脉冲圆环动画（模拟呼叫）
            const pulseRing = document.createElement('div');
            pulseRing.style.cssText = `
            position: absolute;
            width: 140px;
            height: 140px;
            border: 3px solid rgba(102, 126, 234, 0.6);
            border-radius: 50%;
            animation: pulse 1.5s ease-out infinite;
        `;
            avatar.appendChild(pulseRing);

            // 状态文本
            const statusText = document.createElement('div');
            statusText.textContent = '正在连接通话...';
            statusText.style.cssText = `
            color: #2d3748;
            font-size: 18px;
            font-weight: 500;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin-bottom: 10px;
        `;

            // 提示文本
            const hintText = document.createElement('div');
            hintText.textContent = '请稍候...';
            hintText.style.cssText = `
            color: #718096;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;

            // 添加动画样式
            const style = document.createElement('style');
            style.textContent = `
            @keyframes pulse {
                0% {
                    transform: scale(1);
                    opacity: 1;
                }
                100% {
                    transform: scale(1.3);
                    opacity: 0;
                }
            }
        `;
            document.head.appendChild(style);

            this.loadingElement.appendChild(avatar);
            this.loadingElement.appendChild(statusText);
            this.loadingElement.appendChild(hintText);
            this.container.appendChild(this.loadingElement);
        }

        /**
         * 隐藏加载动画
         */
        hideLoading() {
            if (this.loadingElement) {
                // 添加淡出动画
                this.loadingElement.style.transition = 'opacity 0.5s ease';
                this.loadingElement.style.opacity = '0';

                setTimeout(() => {
                    if (this.loadingElement && this.loadingElement.parentNode) {
                        this.loadingElement.parentNode.removeChild(this.loadingElement);
                        this.loadingElement = null;
                    }
                }, 500);
            }

            // 同时让场景淡入显示
            this.showScene();
        }

        /**
         * 显示场景（淡入效果）
         */
        showScene() {
            if (this.renderer && this.renderer.domElement) {
                // 使用 requestAnimationFrame 确保样式已应用
                requestAnimationFrame(() => {
                    this.renderer.domElement.style.opacity = '1';
                });
            }
        }

        /**
         * 销毁
         */
        destroy() {
            // 停止渲染循环
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
            }

            // 清理背景
            if (this.backgroundTexture) {
                this.backgroundTexture.dispose();
            }

            // 清理渲染器
            if (this.renderer) {
                this.renderer.dispose();
                if (this.renderer.domElement.parentNode) {
                    this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
                }
            }

            // 清理控制器
            if (this.controls) {
                this.controls.dispose();
            }

            // 移除事件监听
            window.removeEventListener('resize', this._onWindowResize);
        }
    }

    /**
     * 动画控制器
     */
    class AnimationController {
        constructor(avatar, mixer) {
            this.avatar = avatar;
            this.mixer = mixer || new THREE__namespace.AnimationMixer(avatar);

            // 动画存储
            this.animations = new Map(); // name -> { clip, action }
            this.currentAction = null;
            this.loader = new GLTFLoader_js.GLTFLoader();
        }

        /**
         * 加载动画
         * @param {string} name - 动画名称（如 'idle', 'talking'）
         * @param {string} url - GLB 文件 URL
         */
        async loadAnimation(name, url) {
            console.log(`📥 Loading animation "${name}" from:`, url);
            return new Promise((resolve, reject) => {
                this.loader.load(
                    url,
                    (gltf) => {
                        if (gltf.animations && gltf.animations.length > 0) {
                            const clip = gltf.animations[0];
                            const action = this.mixer.clipAction(clip);
                            action.setLoop(THREE__namespace.LoopRepeat);

                            this.animations.set(name, { clip, action });
                            console.log(`✅ Animation "${name}" loaded successfully (duration: ${clip.duration.toFixed(2)}s)`);
                            resolve({ name, clip, action });
                        } else {
                            reject(new Error(`No animations found in ${url}`));
                        }
                    },
                    (progress) => {
                        const percent = (progress.loaded / progress.total * 100).toFixed(0);
                        console.log(`⏳ Loading "${name}": ${percent}%`);
                    },
                    (error) => {
                        console.error(`❌ Failed to load animation "${name}":`, error);
                        reject(error);
                    }
                );
            });
        }

        /**
         * 播放动画
         * @param {string} name - 动画名称
         * @param {number} fadeTime - 淡入时间（秒）
         */
        play(name, fadeTime = 0.3) {
            const animation = this.animations.get(name);
            if (!animation) {
                console.warn(`❌ Animation "${name}" not loaded`);
                console.log('Available animations:', Array.from(this.animations.keys()));
                return;
            }

            const { action } = animation;

            // 如果有正在播放的动画，淡出
            if (this.currentAction && this.currentAction !== action) {
                console.log(`⏸️ Fading out previous animation`);
                this.currentAction.fadeOut(fadeTime);
            }

            // 淡入新动画
            action.reset();
            action.fadeIn(fadeTime);
            action.play();

            this.currentAction = action;
            console.log(`▶️ Playing animation "${name}" (weight: ${action.getEffectiveWeight()})`);
        }

        /**
         * 停止动画
         * @param {string} name - 动画名称（可选，不传则停止当前动画）
         * @param {number} fadeTime - 淡出时间（秒）
         */
        stop(name = null, fadeTime = 0.3) {
            if (name) {
                const animation = this.animations.get(name);
                if (animation) {
                    animation.action.fadeOut(fadeTime);
                }
            } else if (this.currentAction) {
                this.currentAction.fadeOut(fadeTime);
                this.currentAction = null;
            }
        }

        /**
         * 停止所有动画
         */
        stopAll() {
            this.animations.forEach(({ action }) => {
                action.stop();
            });
            this.currentAction = null;
        }

        /**
         * 销毁
         */
        destroy() {
            this.stopAll();
            this.animations.clear();
        }
    }

    /**
     * 口型同步引擎
     */
    class LipSyncEngine {
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

            // 流式模式相关
            this.isStreamingMode = false;
            this.externalAnalyser = null;
            this.streamStartTime = 0;

            // 配置
            this.config = DEFAULT_CONFIG.LIP_SYNC;
            this.phonemeMap = DEFAULT_CONFIG.PHONEME_TO_VISEME;
        }

        /**
         * 启动口型同步（传统模式：使用 audio 元素）
         */
        start(audioElement) {
            if (!this.morphTargetMesh) {
                console.error('❌ morphTargetMesh not initialized');
                return;
            }

            // 初始化音频上下文（如果不存在或已关闭，则创建新的）
            if (!this.audioContext || this.audioContext.state === 'closed') {
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
                try {
                    this.audioSource.disconnect();
                } catch (e) {
                    // 已经断开连接
                }
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
            this.isStreamingMode = false;
            this.currentPhoneme = 'sil';
            this.currentViseme = 'viseme_sil';
            this.lastPhonemeTime = Date.now();

            // 开始更新循环
            this._update(audioElement);
        }

        /**
         * 启动流式口型同步（使用外部 AnalyserNode）
         * @param {AnalyserNode} analyser - Web Audio API 的 AnalyserNode
         * @param {AudioContext} audioContext - 音频上下文
         */
        startStreaming(analyser, audioContext) {
            if (!this.morphTargetMesh) {
                console.error('❌ morphTargetMesh not initialized');
                return;
            }

            if (!analyser || !audioContext) {
                console.error('❌ analyser and audioContext are required for streaming mode');
                return;
            }

            // 保存外部 analyser
            this.externalAnalyser = analyser;
            this.audioContext = audioContext;
            this.analyser = analyser;

            // 重置状态
            this.isActive = true;
            this.isClosing = false;
            this.isStreamingMode = true;
            this.currentPhoneme = 'sil';
            this.currentViseme = 'viseme_sil';
            this.lastPhonemeTime = Date.now();
            this.streamStartTime = Date.now();

            // 开始更新循环（流式模式）
            this._updateStreaming();
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

            // 清理流式模式状态
            if (this.isStreamingMode) {
                this.externalAnalyser = null;
            }
        }

        /**
         * 流式模式更新循环
         */
        _updateStreaming() {
            if (!this.isActive && !this.isClosing) {
                return;
            }

            // 闭合逻辑
            if (this.isClosing) {
                this._closeVisemes();
                if (!this.isClosing) {
                    return; // 闭合完成
                }
                requestAnimationFrame(() => this._updateStreaming());
                return;
            }

            // 继续更新
            requestAnimationFrame(() => this._updateStreaming());

            // 获取频率数据
            const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.analyser.getByteFrequencyData(dataArray);

            // 使用当前时间模拟 currentTime
            const elapsedTime = (Date.now() - this.streamStartTime) / 1000;

            // 执行音素分析和更新
            this._analyzeAndUpdateVisemes(dataArray, elapsedTime);
        }

        /**
         * 更新循环（传统模式）
         */
        _update(audioElement) {
            if (!this.isActive && !this.isClosing) {
                return;
            }

            // 闭合逻辑
            if (this.isClosing) {
                this._closeVisemes();
                if (!this.isClosing) {
                    return; // 闭合完成
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

            // 执行音素分析和更新
            this._analyzeAndUpdateVisemes(dataArray, audioElement.currentTime);
        }

        /**
         * 闭合 visemes（共享方法）
         * @private
         */
        _closeVisemes() {
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
            }
        }

        /**
         * 分析音频频谱并更新 visemes（共享方法）
         * @private
         * @param {Uint8Array} dataArray - 频谱数据
         * @param {number} currentTime - 当前播放时间（秒）
         */
        _analyzeAndUpdateVisemes(dataArray, currentTime) {
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

    /**
     * 表情管理器
     */
    class ExpressionManager {
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

    /**
     * 简单的事件发射器
     */
    class EventEmitter {
        constructor() {
            this._events = {};
        }

        /**
         * 监听事件
         */
        on(event, callback) {
            if (!this._events[event]) {
                this._events[event] = [];
            }
            this._events[event].push(callback);
            return this;
        }

        /**
         * 监听一次
         */
        once(event, callback) {
            const wrapper = (...args) => {
                callback(...args);
                this.off(event, wrapper);
            };
            return this.on(event, wrapper);
        }

        /**
         * 移除监听
         */
        off(event, callback) {
            if (!this._events[event]) {
                return this;
            }

            if (!callback) {
                delete this._events[event];
                return this;
            }

            this._events[event] = this._events[event].filter(cb => cb !== callback);
            return this;
        }

        /**
         * 触发事件
         */
        emit(event, ...args) {
            if (!this._events[event]) {
                return this;
            }

            this._events[event].forEach(callback => {
                callback(...args);
            });
            return this;
        }

        /**
         * 移除所有监听
         */
        removeAllListeners(event) {
            if (event) {
                delete this._events[event];
            } else {
                this._events = {};
            }
            return this;
        }
    }

    /**
     * 音频处理工具函数
     */

    /**
     * 将 PCM 原始音频数据转换为 WAV 格式
     * @param {ArrayBuffer|Uint8Array} pcmData - PCM 原始音频数据
     * @param {Object} options - 音频参数
     * @param {number} options.sampleRate - 采样率（默认 16000）
     * @param {number} options.numChannels - 声道数（默认 1，单声道）
     * @param {number} options.bitDepth - 位深度（默认 16）
     * @returns {ArrayBuffer} WAV 格式的音频数据
     */
    function pcmToWav(pcmData, options = {}) {
        const {
            sampleRate = 16000,
            numChannels = 1,
            bitDepth = 16
        } = options;

        // 确保 pcmData 是 Uint8Array
        const pcmBytes = pcmData instanceof Uint8Array ? pcmData : new Uint8Array(pcmData);

        const bytesPerSample = bitDepth / 8;
        pcmBytes.length / bytesPerSample;

        // WAV 文件总大小 = 44 字节头 + PCM 数据大小
        const wavBuffer = new ArrayBuffer(44 + pcmBytes.length);
        const view = new DataView(wavBuffer);

        // 写入 WAV 文件头
        // RIFF chunk descriptor
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + pcmBytes.length, true);  // 文件大小 - 8
        writeString(view, 8, 'WAVE');

        // fmt sub-chunk
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);                    // fmt chunk size (16 for PCM)
        view.setUint16(20, 1, true);                     // audio format (1 = PCM)
        view.setUint16(22, numChannels, true);           // number of channels
        view.setUint32(24, sampleRate, true);            // sample rate
        view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);  // byte rate
        view.setUint16(32, numChannels * bytesPerSample, true);  // block align
        view.setUint16(34, bitDepth, true);              // bits per sample

        // data sub-chunk
        writeString(view, 36, 'data');
        view.setUint32(40, pcmBytes.length, true);       // data size

        // 写入 PCM 数据
        const wavBytes = new Uint8Array(wavBuffer);
        wavBytes.set(pcmBytes, 44);

        return wavBuffer;
    }

    /**
     * 将字符串写入 DataView
     * @private
     */
    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    /**
     * 检测音频数据是否为 PCM 格式（没有 WAV 头）
     * @param {ArrayBuffer} audioData - 音频数据
     * @returns {boolean}
     */
    function isPCM(audioData) {
        if (audioData.byteLength < 12) {
            return false;
        }

        const view = new DataView(audioData);

        // 检查是否有 RIFF 标识
        const riff = String.fromCharCode(
            view.getUint8(0),
            view.getUint8(1),
            view.getUint8(2),
            view.getUint8(3)
        );

        // 如果不是 RIFF，则认为是 PCM
        return riff !== 'RIFF';
    }

    /**
     * 自动处理音频数据：如果是 PCM 则转换为 WAV
     * @param {ArrayBuffer} audioData - 音频数据
     * @param {Object} options - 音频参数（仅当检测到 PCM 时使用）
     * @returns {ArrayBuffer}
     */
    function processAudioData(audioData, options = {}) {
        if (isPCM(audioData)) {
            console.log('🔄 检测到 PCM 格式，自动转换为 WAV');
            return pcmToWav(audioData, options);
        }
        return audioData;
    }

    /**
     * 创建音频处理管道，用于流式 PCM 转 WAV
     * 支持逐步接收 PCM 片段并转换为 WAV
     */
    class PCMToWavConverter {
        constructor(options = {}) {
            this.sampleRate = options.sampleRate || 16000;
            this.numChannels = options.numChannels || 1;
            this.bitDepth = options.bitDepth || 16;
        }

        /**
         * 转换单个 PCM 片段为 WAV
         * @param {ArrayBuffer|Uint8Array} pcmChunk - PCM 片段
         * @returns {ArrayBuffer} WAV 格式的音频
         */
        convert(pcmChunk) {
            return pcmToWav(pcmChunk, {
                sampleRate: this.sampleRate,
                numChannels: this.numChannels,
                bitDepth: this.bitDepth
            });
        }

        /**
         * 批量转换 PCM 片段
         * @param {Array<ArrayBuffer>} pcmChunks - PCM 片段数组
         * @returns {Array<ArrayBuffer>} WAV 格式的音频数组
         */
        convertBatch(pcmChunks) {
            return pcmChunks.map(chunk => this.convert(chunk));
        }
    }

    /**
     * 音频流队列管理器
     * 用于处理流式音频片段的无缝播放
     */
    class AudioStreamQueue {
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

    /**
     * 说话检测器
     * 基于音频能量分析检测用户是否在说话
     */
    class SpeechDetector {
        constructor(analyser, options = {}) {
            this.analyser = analyser;

            // 配置参数
            this.threshold = options.threshold || 30;                    // 能量阈值（默认 30，降低以提高灵敏度）
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

            // 每秒打印一次音频能量（用于调试）
            if (this.lastLogTime === undefined || now - this.lastLogTime > 1000) {
                console.log(`[VAD] 音频能量: ${energy.toFixed(1)} (阈值: ${this.threshold}) - ${isCurrentlySpeaking ? '🟢 检测到声音' : '⚪ 静音'}`);
                this.lastLogTime = now;
            }

            if (isCurrentlySpeaking) {
                // 检测到声音
                this.lastSpeechTime = now;

                if (!this.isSpeaking) {
                    // 从静音到说话
                    if (this.speechStartTime === 0) {
                        this.speechStartTime = now;
                        console.log(`[VAD] 🎤 开始检测声音，等待持续 ${this.minSpeakDuration}ms...`);
                    }

                    // 持续说话超过最小时长，触发开始事件
                    const speakDuration = now - this.speechStartTime;
                    if (speakDuration >= this.minSpeakDuration) {
                        this.isSpeaking = true;
                        this.silenceStartTime = 0;

                        console.log(`[VAD] 🗣️ 说话开始！持续时长: ${speakDuration}ms`);

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
                        console.log(`[VAD] 🔇 检测到静音，等待持续 ${this.silenceDuration}ms...`);
                    }

                    // 持续静音超过阈值，触发结束事件
                    const silenceDuration = now - this.silenceStartTime;
                    if (silenceDuration >= this.silenceDuration) {
                        this.isSpeaking = false;
                        this.speechStartTime = 0;
                        this.silenceStartTime = 0;

                        console.log(`[VAD] ⏹️ 说话结束！静音持续: ${silenceDuration}ms`);

                        if (this.onSpeakingEnd) {
                            this.onSpeakingEnd();
                        }
                    }
                } else {
                    // 持续静音，重置说话开始时间
                    if (this.speechStartTime !== 0) {
                        console.log(`[VAD] ⚠️ 声音持续时间不足 ${this.minSpeakDuration}ms，已重置`);
                    }
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
         * 获取当前音频能量
         * @returns {number} 当前能量值 (0-255)
         */
        getCurrentEnergy() {
            return this._getAudioEnergy();
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

    /**
     * 循环视频缓冲区
     * 维护最近 N 秒的视频片段
     * 策略：始终保留第一个 chunk（包含 WebM 头部），然后循环存储最近的数据
     */
    class CircularVideoBuffer {
        constructor(duration = 5000) {
            this.maxDuration = duration; // 最大缓冲时长（毫秒）
            this.chunks = [];            // 视频数据块
            this.timestamps = [];        // 对应的时间戳
            this.startTime = null;       // 缓冲区开始时间
            this.firstChunk = null;      // 第一个 chunk（包含 WebM 头部，永不删除）
            this.firstTimestamp = null;  // 第一个 chunk 的时间戳
        }

        /**
         * 添加视频片段
         * @param {Blob} chunk - 视频数据块
         * @param {number} timestamp - 时间戳（毫秒）
         */
        add(chunk, timestamp) {
            if (this.startTime === null) {
                this.startTime = timestamp;
            }

            // 保存第一个 chunk（包含 WebM 头部，必须保留）
            if (this.firstChunk === null) {
                this.firstChunk = chunk;
                this.firstTimestamp = timestamp;
                console.log(`[CircularBuffer] Saved first chunk (${chunk.size} bytes) - contains WebM header`);
            }

            this.chunks.push(chunk);
            this.timestamps.push(timestamp);

            // 移除超过最大时长的旧片段（但不删除第一个 chunk）
            this._pruneOldChunks(timestamp);
        }

        /**
         * 清理超过最大时长的旧片段
         * 保证第一个 chunk 永不被删除
         * @private
         * @param {number} currentTime - 当前时间戳
         */
        _pruneOldChunks(currentTime) {
            const cutoffTime = currentTime - this.maxDuration;
            let removedCount = 0;

            // 从第二个 chunk 开始检查（索引1），第一个 chunk（索引0）永远保留
            // 删除所有时间戳早于 cutoffTime 的 chunks，但保留第一个
            while (this.chunks.length > 1 && this.timestamps[0] !== this.firstTimestamp && this.timestamps[0] < cutoffTime) {
                this.chunks.shift();
                this.timestamps.shift();
                removedCount++;
            }

            if (removedCount > 0) {
                console.log(`[CircularBuffer] Pruned ${removedCount} old chunks, keeping ${this.chunks.length} chunks (duration: ${this.getDuration()}ms)`);
            }

            // 更新开始时间
            if (this.timestamps.length > 0) {
                this.startTime = this.timestamps[0];
            }
        }

        /**
         * 获取所有缓冲的视频片段
         * @returns {Blob[]} 视频数据块数组
         */
        getAll() {
            console.log(`[CircularBuffer] Returning ${this.chunks.length} chunks, duration: ${this.getDuration()}ms`);
            return [...this.chunks];
        }

        /**
         * 获取缓冲区的时长（毫秒）
         * 基于实际保留的数据片段计算
         * @returns {number}
         */
        getDuration() {
            if (this.timestamps.length === 0) {
                return 0;
            }

            if (this.timestamps.length === 1) {
                return 0; // 只有第一个chunk，时长为0
            }

            // 如果第一个chunk还在，从第二个chunk开始计算实际数据时长
            const startIdx = (this.timestamps[0] === this.firstTimestamp) ? 1 : 0;

            if (startIdx >= this.timestamps.length) {
                return 0;
            }

            // 计算实际媒体数据的时长（排除第一个初始化chunk）
            const duration = this.timestamps[this.timestamps.length - 1] - this.timestamps[startIdx];

            // 时长不应超过最大缓冲时长
            return Math.min(duration, this.maxDuration);
        }

        /**
         * 获取缓冲区的片段数量
         * @returns {number}
         */
        getChunkCount() {
            return this.chunks.length;
        }

        /**
         * 清空缓冲区
         */
        clear() {
            this.chunks = [];
            this.timestamps = [];
            this.startTime = null;
            this.firstChunk = null;
            this.firstTimestamp = null;
        }

        /**
         * 获取缓冲区总大小（字节）
         * @returns {number}
         */
        getTotalSize() {
            return this.chunks.reduce((total, chunk) => total + chunk.size, 0);
        }

        /**
         * 检查缓冲区是否为空
         * @returns {boolean}
         */
        isEmpty() {
            return this.chunks.length === 0;
        }
    }

    /**
     * 视频自动采集管理器
     * 自动采集【最近5秒 + 检测到说话期间】的视频
     */
    class VideoAutoCaptureManager {
        constructor(mediaStream, options = {}) {
            this.mediaStream = mediaStream;

            // 配置参数
            this.config = {
                bufferDuration: options.bufferDuration || 5000,           // 缓冲区时长（默认 5000ms）
                speechThreshold: options.speechThreshold || 40,           // 说话检测阈值（默认 40）
                silenceDuration: options.silenceDuration || 2000,         // 静音持续时间（默认 2000ms）
                minSpeakDuration: options.minSpeakDuration || 500,        // 最小说话时长（默认 500ms）
                maxRecordDuration: options.maxRecordDuration || 300000,   // 最大录制时长（默认 5 分钟）
                videoFormat: options.videoFormat || 'video/webm',         // 视频格式（默认 webm）
                videoBitsPerSecond: options.videoBitsPerSecond || 2500000 // 视频比特率（默认 2.5 Mbps）
            };

            // 回调函数
            this.onVideoCapture = options.onVideoCapture || null;
            this.onSpeakingStart = options.onSpeakingStart || null;
            this.onSpeakingEnd = options.onSpeakingEnd || null;
            this.onError = options.onError || null;

            // 状态
            this.isRunning = false;
            this.isRecording = false;

            // 模块
            this.mediaRecorder = null;
            this.circularBuffer = null;
            this.speechDetector = null;
            this.audioContext = null;
            this.audioAnalyser = null;

            // 录制数据
            this.recordingChunks = [];
            this.recordingStartTime = null;
            this.recordingTimeout = null;
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
                this.circularBuffer = new CircularVideoBuffer(this.config.bufferDuration);

                // 2. 初始化音频分析器
                this._initAudioAnalyser();

                // 3. 初始化说话检测器
                this._initSpeechDetector();

                // 4. 初始化 MediaRecorder
                this._initMediaRecorder();

                // 5. 启动录制和检测
                console.log('[VideoCapture] Starting MediaRecorder with 100ms timeslice...');
                this.mediaRecorder.start(100); // 每 100ms 产生一个数据块
                console.log('[VideoCapture] MediaRecorder state:', this.mediaRecorder.state);

                this.speechDetector.start(100); // 每 100ms 检测一次

                this.isRunning = true;

                console.log('✅ VideoAutoCaptureManager started');

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

            // 停止说话检测
            if (this.speechDetector) {
                this.speechDetector.stop();
            }

            // 停止 MediaRecorder
            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
            }

            // 清理录制超时
            if (this.recordingTimeout) {
                clearTimeout(this.recordingTimeout);
                this.recordingTimeout = null;
            }

            // 清空缓冲区
            if (this.circularBuffer) {
                this.circularBuffer.clear();
            }

            // 关闭音频上下文
            if (this.audioContext && this.audioContext.state !== 'closed') {
                this.audioContext.close();
            }

            this.isRunning = false;
            this.isRecording = false;

            console.log('⏹ VideoAutoCaptureManager stopped');
        }

        /**
         * 初始化音频分析器
         * @private
         */
        _initAudioAnalyser() {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioAnalyser = this.audioContext.createAnalyser();
            this.audioAnalyser.fftSize = 2048;
            this.audioAnalyser.smoothingTimeConstant = 0.8;

            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            source.connect(this.audioAnalyser);
        }

        /**
         * 初始化说话检测器
         * @private
         */
        _initSpeechDetector() {
            this.speechDetector = new SpeechDetector(this.audioAnalyser, {
                threshold: this.config.speechThreshold,
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
            console.log(`[VideoCapture] Requested MIME type: ${mimeType}`);

            if (!MediaRecorder.isTypeSupported(mimeType)) {
                console.warn(`[VideoCapture] ${mimeType} not supported, trying fallback formats`);

                // 尝试备选格式
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
            } else {
                console.log(`[VideoCapture] Using supported format: ${mimeType}`);
            }

            this.mediaRecorder = new MediaRecorder(this.mediaStream, {
                mimeType: mimeType,
                videoBitsPerSecond: this.config.videoBitsPerSecond
            });

            console.log(`[VideoCapture] MediaRecorder created with mimeType: ${this.mediaRecorder.mimeType}`);

            // 数据可用事件
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    const timestamp = Date.now();

                    if (this.isRecording) {
                        // 正在录制，保存到录制缓冲区
                        this.recordingChunks.push(event.data);
                        console.log(`[Recording] Added chunk ${this.recordingChunks.length}, size: ${event.data.size} bytes`);
                    } else if (this.circularBuffer) {
                        // 循环缓冲区模式（检查缓冲区是否存在）
                        this.circularBuffer.add(event.data, timestamp);
                        console.log(`[Buffer] Added chunk, buffer size: ${this.circularBuffer.getChunkCount()}, duration: ${this.circularBuffer.getDuration()}ms`);
                    }
                } else {
                    console.warn('[VideoCapture] ondataavailable fired but data is empty or zero size');
                }
            };

            // 停止事件
            this.mediaRecorder.onstop = () => {
                console.log('MediaRecorder stopped');
            };

            // 错误事件
            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event);
                if (this.onError) {
                    this.onError(event.error);
                }
            };
        }

        /**
         * 处理说话开始
         * @private
         */
        _handleSpeakingStart() {
            console.log('🗣️ Speaking started');

            // 触发用户回调
            if (this.onSpeakingStart) {
                this.onSpeakingStart();
            }

            // 开始录制
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            this.recordingChunks = [];

            // 将循环缓冲区的内容添加到录制缓冲区
            const bufferedChunks = this.circularBuffer.getAll();
            this.recordingChunks.push(...bufferedChunks);

            console.log(`📹 Recording started with ${bufferedChunks.length} buffered chunks (${this.circularBuffer.getDuration()}ms)`);

            // 设置最大录制时长限制
            this.recordingTimeout = setTimeout(() => {
                console.warn('⚠️ Max recording duration reached, forcing stop');
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
            if (this.recordingTimeout) {
                clearTimeout(this.recordingTimeout);
                this.recordingTimeout = null;
            }

            // 停止录制
            this.isRecording = false;

            // 计算录制时长
            const duration = Date.now() - this.recordingStartTime;

            // 合并视频片段
            const videoBlob = new Blob(this.recordingChunks, { type: this.config.videoFormat });

            console.log(`📹 Recording finished: ${this.recordingChunks.length} chunks, ${duration}ms, ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);

            // 生成元数据
            const metadata = {
                duration: duration,
                startTime: this.recordingStartTime,
                endTime: Date.now(),
                size: videoBlob.size,
                chunkCount: this.recordingChunks.length,
                format: this.config.videoFormat
            };

            // 触发视频捕获回调
            if (this.onVideoCapture) {
                this.onVideoCapture(videoBlob, metadata);
            }

            // 清空录制缓冲区
            this.recordingChunks = [];
            this.recordingStartTime = null;
        }

        /**
         * 获取当前状态
         * @returns {Object}
         */
        getStatus() {
            return {
                isRunning: this.isRunning,
                isRecording: this.isRecording,
                bufferDuration: this.circularBuffer ? this.circularBuffer.getDuration() : 0,
                bufferChunks: this.circularBuffer ? this.circularBuffer.getChunkCount() : 0,
                bufferSize: this.circularBuffer ? this.circularBuffer.getTotalSize() : 0,
                recordingDuration: this.isRecording ? Date.now() - this.recordingStartTime : 0,
                recordingChunks: this.recordingChunks.length,
                currentEnergy: this.speechDetector ? this.speechDetector.getCurrentEnergy() : 0,
                threshold: this.config.speechThreshold,
                isSpeaking: this.speechDetector ? this.speechDetector.getSpeakingState() : false
            };
        }

        /**
         * 获取当前缓冲区的视频（最近5秒）
         * @returns {Object|null} { blob: Blob, metadata: Object } 或 null
         */
        getCurrentBufferVideo() {
            if (!this.circularBuffer || this.circularBuffer.getChunkCount() === 0) {
                console.warn('[VideoCapture] Cannot get buffer video: buffer is empty or null');
                return null;
            }

            const chunks = this.circularBuffer.getAll();

            // 详细诊断
            console.log(`[VideoCapture] Getting buffer video:`);
            console.log(`  - Total chunks: ${chunks.length}`);
            console.log(`  - First chunk size: ${chunks[0]?.size || 0} bytes (should be init segment)`);
            console.log(`  - Chunk sizes:`, chunks.map(c => c.size));
            console.log(`  - Using mimeType: ${this.config.videoFormat}`);

            const videoBlob = new Blob(chunks, { type: this.config.videoFormat });

            const metadata = {
                duration: this.circularBuffer.getDuration(),
                size: videoBlob.size,
                chunkCount: chunks.length,
                format: this.config.videoFormat,
                type: 'buffer' // 标记这是缓冲区视频
            };

            console.log(`📹 Current buffer video: ${chunks.length} chunks, ${metadata.duration}ms, ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);

            return { blob: videoBlob, metadata };
        }

        /**
         * 销毁管理器
         */
        destroy() {
            this.stop();

            this.circularBuffer = null;
            this.speechDetector = null;
            this.mediaRecorder = null;
            this.audioAnalyser = null;
            this.audioContext = null;

            this.onVideoCapture = null;
            this.onSpeakingStart = null;
            this.onSpeakingEnd = null;
            this.onError = null;

            console.log('🗑️ VideoAutoCaptureManager destroyed');
        }
    }

    /**
     * 数字人组件
     */
    class DigitalHuman extends EventEmitter {
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
                const loader = new GLTFLoader_js.GLTFLoader();
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
                            const lookAtTarget = new THREE__namespace.Vector3(
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
                if (isCurrentlySmallWindow) {
                    // ===== 从 "摄像头主窗口" 切换到 "数字人主窗口" =====

                    // 1. 停止音频可视化
                    if (this.visualizerAnimationId) {
                        cancelAnimationFrame(this.visualizerAnimationId);
                        this.visualizerAnimationId = null;
                    }

                    // 2. 获取需要的元素和配置
                    const digitalHumanCanvas = this.sceneManager.renderer.domElement;
                    const pipScale = options.pipScale || 0.25;
                    const pipWidth = container.offsetWidth * pipScale;
                    const pipHeight = container.offsetHeight * pipScale;
                    const pipPosition = options.pipPosition || this.currentPipPosition || 'bottom-right';

                    const positions = {
                        'bottom-right': { bottom: '20px', right: '20px' },
                        'bottom-left': { bottom: '20px', left: '20px' },
                        'top-right': { top: '20px', right: '20px' },
                        'top-left': { top: '20px', left: '20px' }
                    };
                    const posStyle = positions[pipPosition] || positions['bottom-right'];

                    // 3. 移除数字人 PiP 容器的 hover 事件监听器（因为即将变成大窗口）
                    if (this.pipContainer && this.pipMouseEnterHandler) {
                        this.pipContainer.removeEventListener('mouseenter', this.pipMouseEnterHandler);
                        this.pipContainer.removeEventListener('mouseleave', this.pipMouseLeaveHandler);
                        this.pipContainer.removeEventListener('click', this.pipClickHandler);
                        this.pipMouseEnterHandler = null;
                        this.pipMouseLeaveHandler = null;
                        this.pipClickHandler = null;
                    }

                    // 4. 移除摄像头主容器
                    if (this.videoCallContainer && this.videoCallContainer.parentNode) {
                        this.videoCallContainer.parentNode.removeChild(this.videoCallContainer);
                    }

                    // 5. 将数字人 PiP 容器改为全屏
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

                    // 5. 调整数字人 canvas 尺寸到全屏
                    this.sceneManager.renderer.setSize(container.offsetWidth, container.offsetHeight);
                    this.sceneManager.camera.aspect = container.offsetWidth / container.offsetHeight;
                    this.sceneManager.camera.updateProjectionMatrix();

                    // 6. 创建摄像头小窗口
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

                    // 7. 创建摄像头视频元素
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

                    // 8. 添加悬停效果（保存引用以便后续移除）
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

                    // 10. 更新状态
                    this.currentPipScale = 1.0;
                    this.localVideoElement = null;
                    this.videoCallContainer = null;

                } else {
                    // ===== 从 "数字人主窗口" 切换到 "摄像头主窗口" =====

                    // 1. 移除摄像头小窗口的事件监听器
                    if (this.cameraPipContainer && this.cameraPipMouseEnterHandler) {
                        this.cameraPipContainer.removeEventListener('mouseenter', this.cameraPipMouseEnterHandler);
                        this.cameraPipContainer.removeEventListener('mouseleave', this.cameraPipMouseLeaveHandler);
                        this.cameraPipContainer.removeEventListener('click', this.cameraPipClickHandler);
                        this.cameraPipMouseEnterHandler = null;
                        this.cameraPipMouseLeaveHandler = null;
                        this.cameraPipClickHandler = null;
                    }

                    // 2. 获取配置
                    const pipScale = options.pipScale || 0.25;
                    const pipWidth = container.offsetWidth * pipScale;
                    const pipHeight = container.offsetHeight * pipScale;
                    const pipPosition = options.pipPosition || this.currentPipPosition || 'bottom-right';

                    const positions = {
                        'bottom-right': { bottom: '20px', right: '20px' },
                        'bottom-left': { bottom: '20px', left: '20px' },
                        'top-right': { top: '20px', right: '20px' },
                        'top-left': { top: '20px', left: '20px' }
                    };
                    const posStyle = positions[pipPosition] || positions['bottom-right'];

                    // 3. 移除摄像头小窗口
                    if (this.cameraPipContainer && this.cameraPipContainer.parentNode) {
                        this.cameraPipContainer.parentNode.removeChild(this.cameraPipContainer);
                    }

                    // 4. 创建摄像头主容器
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

                    // 5. 创建本地视频元素
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

                    // 6. 创建音频可视化 canvas
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

                    // 7. 调整数字人 PiP 容器为小窗口
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

                    // 8. 调整数字人 canvas 尺寸
                    this.sceneManager.renderer.setSize(pipWidth, pipHeight);
                    this.sceneManager.camera.aspect = pipWidth / pipHeight;
                    this.sceneManager.camera.updateProjectionMatrix();

                    // 9. 添加数字人小窗口的悬停效果（保存引用以便后续移除）
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

                    // 10. 重新启动音频可视化
                    if (options.showAudioVisualizer !== false) {
                        this._startAudioVisualizer();
                    }

                    // 11. 更新状态
                    this.currentPipScale = pipScale;
                    this.cameraVideoElement = null;
                    this.cameraPipContainer = null;
                }

                // 保存配置
                this.currentPipPosition = options.pipPosition || this.currentPipPosition;
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
         * 启动视频自动采集
         * @param {Object} options - 配置选项
         * @param {Function} options.onVideoCapture - 视频捕获回调 (videoBlob, metadata) => {}
         * @param {number} [options.bufferDuration=5000] - 缓冲区时长（毫秒）
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
         * 获取当前缓冲区视频（最近5秒）
         * @returns {Object|null} { blob: Blob, metadata: Object } 或 null
         */
        getCurrentBufferVideo() {
            if (!this.videoAutoCaptureManager) {
                return null;
            }

            return this.videoAutoCaptureManager.getCurrentBufferVideo();
        }
    }

    /**
     * 音频流解析器
     *
     * 解决 HTTP 流式传输中的分块问题：
     * - HTTP 会在任意位置切分数据流
     * - 导致前端收到不完整的音频文件（如 WAV）
     * - decodeAudioData() 解码失败
     *
     * 工作原理：
     * 1. 缓冲所有接收到的数据
     * 2. 检测完整的音频文件边界（RIFF WAV）
     * 3. 提取完整的音频文件
     * 4. 只传递完整文件给解码器
     */
    class AudioStreamParser {
        constructor(options = {}) {
            // 数据缓冲区
            this.buffer = new Uint8Array(0);

            // 配置
            this.config = {
                // 最小文件大小（字节），小于此值不尝试解析
                minFileSize: options.minFileSize || 1024,

                // 最大缓冲区大小（字节），防止内存溢出
                maxBufferSize: options.maxBufferSize || 10 * 1024 * 1024, // 10MB

                // 是否启用调试日志
                debug: options.debug || false
            };
        }

        /**
         * 添加数据块到缓冲区
         * @param {ArrayBuffer|Uint8Array} chunk - 数据块
         */
        addChunk(chunk) {
            const chunkBytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);

            // 检查缓冲区大小
            if (this.buffer.length + chunkBytes.length > this.config.maxBufferSize) {
                throw new Error(`AudioStreamParser: Buffer overflow (max ${this.config.maxBufferSize} bytes)`);
            }

            // 合并到缓冲区
            const newBuffer = new Uint8Array(this.buffer.length + chunkBytes.length);
            newBuffer.set(this.buffer, 0);
            newBuffer.set(chunkBytes, this.buffer.length);
            this.buffer = newBuffer;

            if (this.config.debug) {
                console.log(`[AudioStreamParser] Buffer size: ${this.buffer.length} bytes`);
            }
        }

        /**
         * 从缓冲区提取所有完整的音频文件
         * @returns {Array<ArrayBuffer>} 完整的音频文件数组
         */
        extractComplete() {
            const completeFiles = [];

            while (this.buffer.length >= this.config.minFileSize) {
                // 查找 RIFF WAV 文件
                const fileInfo = this._findNextWavFile();

                if (!fileInfo) {
                    // 没有找到完整文件，等待更多数据
                    break;
                }

                const { start, size } = fileInfo;

                // 检查是否有完整的文件数据
                if (start + size > this.buffer.length) {
                    // 文件不完整，等待更多数据
                    if (this.config.debug) {
                        console.log(`[AudioStreamParser] Incomplete file: need ${start + size} bytes, have ${this.buffer.length}`);
                    }
                    break;
                }

                // 提取完整文件
                const fileData = this.buffer.slice(start, start + size);
                completeFiles.push(fileData.buffer);

                // 从缓冲区移除已提取的文件
                this.buffer = this.buffer.slice(start + size);

                if (this.config.debug) {
                    console.log(`[AudioStreamParser] Extracted complete file: ${size} bytes, remaining buffer: ${this.buffer.length}`);
                }
            }

            return completeFiles;
        }

        /**
         * 查找缓冲区中下一个完整的 WAV 文件
         * @private
         * @returns {{start: number, size: number}|null}
         */
        _findNextWavFile() {
            // 查找 "RIFF" 标识
            for (let i = 0; i <= this.buffer.length - 8; i++) {
                // 检查是否是 RIFF
                if (this.buffer[i] === 0x52 &&      // 'R'
                    this.buffer[i + 1] === 0x49 &&  // 'I'
                    this.buffer[i + 2] === 0x46 &&  // 'F'
                    this.buffer[i + 3] === 0x46) {  // 'F'

                    // 读取文件大小（小端序）
                    const fileSize = this._readUint32LE(this.buffer, i + 4);

                    // WAV 文件总大小 = 8 字节（RIFF + size） + fileSize
                    const totalSize = 8 + fileSize;

                    // 验证 WAVE 标识
                    if (i + 12 <= this.buffer.length &&
                        this.buffer[i + 8] === 0x57 &&   // 'W'
                        this.buffer[i + 9] === 0x41 &&   // 'A'
                        this.buffer[i + 10] === 0x56 &&  // 'V'
                        this.buffer[i + 11] === 0x45) {  // 'E'

                        if (this.config.debug) {
                            console.log(`[AudioStreamParser] Found WAV file at offset ${i}, size ${totalSize} bytes`);
                        }

                        return {
                            start: i,
                            size: totalSize
                        };
                    }
                }
            }

            return null;
        }

        /**
         * 读取小端序 32 位整数
         * @private
         */
        _readUint32LE(buffer, offset) {
            return buffer[offset] |
                   (buffer[offset + 1] << 8) |
                   (buffer[offset + 2] << 16) |
                   (buffer[offset + 3] << 24);
        }

        /**
         * 清空缓冲区
         */
        clear() {
            this.buffer = new Uint8Array(0);
        }

        /**
         * 获取当前缓冲区大小
         */
        getBufferSize() {
            return this.buffer.length;
        }

        /**
         * 处理流结束：返回缓冲区中剩余的数据
         * @returns {Array<ArrayBuffer>}
         */
        finalize() {
            const files = this.extractComplete();

            // 如果还有剩余数据，警告
            if (this.buffer.length > 0) {
                console.warn(`[AudioStreamParser] ${this.buffer.length} bytes remaining in buffer (incomplete file)`);
            }

            return files;
        }
    }

    /**
     * 辅助函数：包装异步生成器，自动解析完整的音频文件
     *
     * @param {AsyncGenerator<ArrayBuffer>} stream - 原始 HTTP chunk 流
     * @param {Object} options - 解析器配置
     * @returns {AsyncGenerator<ArrayBuffer>} 完整音频文件流
     *
     * @example
     * // 原始用法（有问题）
     * for await (const chunk of httpStream) {
     *     await queue.enqueue(chunk); // ❌ 可能不完整
     * }
     *
     * // 使用解析器（正确）
     * const parsedStream = parseAudioStream(httpStream);
     * for await (const completeFile of parsedStream) {
     *     await queue.enqueue(completeFile); // ✅ 保证完整
     * }
     */
    async function* parseAudioStream(stream, options = {}) {
        const parser = new AudioStreamParser(options);

        try {
            for await (const chunk of stream) {
                // 添加到缓冲区
                parser.addChunk(chunk);

                // 提取所有完整文件
                const completeFiles = parser.extractComplete();

                // 逐个 yield 完整文件
                for (const file of completeFiles) {
                    yield file;
                }
            }

            // 流结束，处理剩余数据
            const remaining = parser.finalize();
            for (const file of remaining) {
                yield file;
            }

        } finally {
            // 清理
            parser.clear();
        }
    }

    exports.AudioStreamParser = AudioStreamParser;
    exports.AudioStreamQueue = AudioStreamQueue;
    exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
    exports.DigitalHuman = DigitalHuman;
    exports.PCMToWavConverter = PCMToWavConverter;
    exports.isPCM = isPCM;
    exports.parseAudioStream = parseAudioStream;
    exports.pcmToWav = pcmToWav;
    exports.processAudioData = processAudioData;

}));
