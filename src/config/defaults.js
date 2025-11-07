/**
 * 默认配置
 */
export const DEFAULT_CONFIG = {
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
