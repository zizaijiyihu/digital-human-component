# Digital Human Component

一个基于 Three.js 和 Ready Player Me 的数字人组件，支持音素驱动的口型同步和自然表情动画。

## ✨ 特性

- 🎭 **Ready Player Me 支持** - 兼容 RPM 模型
- 🗣️ **音素驱动口型同步** - 基于音频频率分析的实时口型同步
- 😊 **自然表情** - 支持眨眼、微笑、点头、扬眉等微表情
- 🎬 **两种场景模式** - 聆听模式和说话模式
- 🎨 **自定义背景** - 支持纯色和图片背景
- 📦 **开箱即用** - CDN 引入即可使用
- 🔧 **高度可配置** - 灵活的 API 设计

## 📦 安装

### 方式 1: 本地开发（推荐）

```bash
git clone https://github.com/zizaijiyihu/digital-human-component.git
cd digital-human-component
npm install
npm run build
```

### 方式 2: CDN 引入（构建后）

```html
<script type="importmap">
{
    "imports": {
        "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
    }
}
</script>

<script type="module">
    import { DigitalHuman } from 'https://cdn.jsdelivr.net/gh/zizaijiyihu/digital-human-component@latest/cdn/digital-human.esm.js';

    const avatar = new DigitalHuman({
        container: '#avatar',
        modelUrl: 'https://models.readyplayer.me/YOUR_MODEL_ID.glb'
    });
</script>
```

## 🚀 快速开始

查看 `examples/basic.html` 示例文件。

```javascript
import { DigitalHuman } from './src/index.js';

const avatar = new DigitalHuman({
    container: '#avatar',
    modelUrl: 'https://models.readyplayer.me/690abee256dbb2e94779a60a.glb',
    autoStart: 'listening',
    onReady: () => console.log('Ready!')
});

// 播放音频
avatar.speak('./audio/hello.wav');
```

## 📖 完整文档

详细 API 文档和使用说明请参考源码注释和示例文件。

## 🛠️ 本地开发

```bash
npm install
npm run build
```

使用 Live Server 或其他本地服务器打开 `examples/basic.html`

## 📄 许可证

MIT License