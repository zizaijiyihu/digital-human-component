import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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
