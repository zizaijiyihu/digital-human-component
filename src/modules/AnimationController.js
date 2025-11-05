import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * 动画控制器
 */
export class AnimationController {
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
