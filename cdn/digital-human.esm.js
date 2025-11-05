import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
    // CDN 基础地址
    CDN_BASE: 'https://cdn.jsdelivr.net/gh/zizaijiyihu/digital-human-component@latest/cdn',

    // 默认动画
    DEFAULT_ANIMATIONS: {
        idle: 'https://cdn.jsdelivr.net/gh/zizaijiyihu/digital-human-component@latest/cdn/animations/F_Standing_Idle_001.glb',
        talking: 'https://cdn.jsdelivr.net/gh/zizaijiyihu/digital-human-component@latest/cdn/animations/F_Talking_Variations_005.glb'
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
        ambient: { color: 0xffffff, intensity: 0.7 },
        key: { color: 0xffffff, intensity: 0.8, position: { x: 0, y: 2, z: 1 } },
        fill: { color: 0xffffff, intensity: 0.4, position: { x: 0, y: 1.6, z: 0.8 } },
        rim: { color: 0xaaccff, intensity: 0.3, position: { x: 0, y: 1.8, z: -0.5 } }
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

        this._init();
    }

    /**
     * 初始化场景
     */
    _init() {
        // 创建场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.config.backgroundColor || '#1a1a2e');

        // 创建相机
        const width = this.config.width || 600;
        const height = this.config.height || 600;
        this.camera = new THREE.PerspectiveCamera(
            DEFAULT_CONFIG.CAMERA.fov,
            width / height,
            DEFAULT_CONFIG.CAMERA.near,
            DEFAULT_CONFIG.CAMERA.far
        );

        const camPos = this.config.cameraPosition || DEFAULT_CONFIG.CAMERA.position;
        this.camera.position.set(camPos.x, camPos.y, camPos.z);

        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // 创建控制器
        if (this.config.enableOrbitControls !== false) {
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
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
        this.clock = new THREE.Clock();

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
        const ambientLight = new THREE.AmbientLight(lights.ambient.color, lights.ambient.intensity);
        this.scene.add(ambientLight);

        // 主光源
        const keyLight = new THREE.DirectionalLight(lights.key.color, lights.key.intensity);
        keyLight.position.set(lights.key.position.x, lights.key.position.y, lights.key.position.z);
        this.scene.add(keyLight);

        // 补光
        const fillLight = new THREE.DirectionalLight(lights.fill.color, lights.fill.intensity);
        fillLight.position.set(lights.fill.position.x, lights.fill.position.y, lights.fill.position.z);
        this.scene.add(fillLight);

        // 轮廓光
        const rimLight = new THREE.DirectionalLight(lights.rim.color, lights.rim.intensity);
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
        this.scene.background = new THREE.Color(color);
    }

    /**
     * 设置背景图片
     */
    async setBackgroundImage(imageUrl) {
        return new Promise((resolve, reject) => {
            const textureLoader = new THREE.TextureLoader();
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
        this.scene.background = new THREE.Color(this.config.backgroundColor || '#1a1a2e');
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
        this.mixer = mixer || new THREE.AnimationMixer(avatar);

        // 动画存储
        this.animations = new Map(); // name -> { clip, action }
        this.currentAction = null;
        this.loader = new GLTFLoader();
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
                        action.setLoop(THREE.LoopRepeat);

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
 * 数字人组件
 */
class DigitalHuman extends EventEmitter {
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
                await this.setBackgroundImage(this.config.backgroundImage);
            }

            // 6. 标记为就绪
            this.isReady = true;
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

export { DEFAULT_CONFIG, DigitalHuman };
