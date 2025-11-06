import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEFAULT_CONFIG } from '../config/defaults.js';

/**
 * 场景管理器
 */
export class SceneManager {
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
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.config.backgroundColor || '#1a1a2e');

        // 创建相机（默认使用容器实际尺寸，避免拉伸）
        const width = this.config.width || this.container.clientWidth || 600;
        const height = this.config.height || this.container.clientHeight || 600;

        console.log('📐 SceneManager initialized with size:', {
            width,
            height,
            aspectRatio: (width / height).toFixed(2),
            containerSize: `${this.container.clientWidth}x${this.container.clientHeight}`
        });

        this.camera = new THREE.PerspectiveCamera(
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
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;

        // 初始时设置 canvas 为透明，等加载完成后淡入
        this.renderer.domElement.style.opacity = '0';
        this.renderer.domElement.style.transition = 'opacity 0.8s ease-in';
        this.renderer.domElement.style.display = 'block';

        this.container.appendChild(this.renderer.domElement);

        // 创建控制器（默认禁用，固定视角）
        if (this.config.enableOrbitControls === true) {
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
