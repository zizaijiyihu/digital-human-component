# Digital Human Component

一个基于 Three.js 和 Ready Player Me 的数字人组件，支持音频驱动的唇形同步和自然的微表情动画。

## ✨ 特性

- 🎭 **两种场景模式**
  - 聆听模式：idle 动画 + 随机微表情（眨眼、微笑3-5秒、点头、挑眉、歪头）
  - 说话模式：talking 动画 + 音素驱动的唇形同步

- 💬 **智能唇形同步**
  - 基于 FFT 音频分析的音素检测
  - 支持 ARKit 标准 viseme 映射

- 🎨 **开箱即用**
  - 默认动画和背景图片（办公背景）
  - 自动从 CDN 加载资源
  - 无需额外配置

## 🚀 快速开始

### 1. 启动本地服务器

```bash
# 下载项目
git clone https://github.com/zizaijiyihu/digital-human-component.git
cd digital-human-component

# 启动服务器（任选一种）
python3 -m http.server 8000        # Python 3
python -m SimpleHTTPServer 8000    # Python 2
npx http-server -p 8000           # Node.js
php -S localhost:8000             # PHP
```

### 2. 在浏览器中打开

```
http://localhost:8000/examples/index.html
```

**重要**：
- ⚠️ 不能直接双击 HTML 文件打开（浏览器会阻止）
- ✅ 必须通过 `http://localhost` 访问
- 🔄 修改代码后强制刷新：`Ctrl+Shift+R` (Windows/Linux) 或 `Cmd+Shift+R` (Mac)

## 📝 使用方法

在你的 HTML 文件中：

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        #avatar { width: 600px; height: 600px; }
    </style>
</head>
<body>
    <div id="avatar"></div>

    <!-- Import Map：告诉浏览器从哪里加载 Three.js -->
    <script type="importmap">
    {
        "imports": {
            "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
            "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
        }
    }
    </script>

    <script type="module">
        // 导入组件
        import { DigitalHuman } from './src/index.js';

        // 创建数字人
        const avatar = new DigitalHuman({
            container: '#avatar',
            modelUrl: 'https://models.readyplayer.me/690abee256dbb2e94779a60a.glb',
            autoStart: 'listening',  // 自动启动聆听模式

            onReady: () => {
                console.log('数字人准备就绪！');
            }
        });

        // 播放音频
        avatar.speak('path/to/audio.wav');
    </script>
</body>
</html>
```

## 🎯 API 说明

### 创建数字人

```javascript
const avatar = new DigitalHuman({
    // === 必填项 ===
    container: '#avatar',              // 容器选择器或 DOM 元素
    modelUrl: 'https://...',           // Ready Player Me 模型 URL

    // === 可选项（都有默认值）===
    autoStart: 'listening',            // 自动启动：'listening' | 'speaking' | null

    // 动画配置（默认使用 CDN 动画）
    useDefaultAnimations: true,        // 是否使用默认动画
    animations: {
        idle: null,                    // 自定义 idle 动画 URL（可选）
        talking: null                  // 自定义 talking 动画 URL（可选）
    },

    // 背景配置（默认使用办公背景图）
    backgroundColor: '#1a1a2e',        // 背景颜色
    backgroundImage: undefined,        // 背景图片 URL（不设置则用默认背景）

    // 尺寸
    width: 600,
    height: 600,

    // 微表情开关
    enableBlinking: true,              // 启用眨眼
    enableSmiling: true,               // 启用微笑
    enableNodding: true,               // 启用点头
    enableBrowRaising: true,           // 启用挑眉
    enableHeadTilting: true,           // 启用歪头

    // 事件回调
    onReady: () => {},                 // 加载完成
    onSpeakStart: () => {},            // 开始说话
    onSpeakEnd: () => {},              // 说话结束
    onListenStart: () => {},           // 开始聆听
    onError: (error) => {}             // 错误处理
});
```

### 方法

```javascript
// 播放音频（URL、Blob 或 ArrayBuffer）
avatar.speak('audio.wav');

// 启动聆听模式
avatar.startListening();

// 停止聆听模式
avatar.stopListening();

// 停止说话
avatar.stopSpeaking();

// 设置背景图片
avatar.setBackgroundImage('image.png');

// 设置背景颜色
avatar.setBackgroundColor('#ffffff');

// 清理资源
avatar.dispose();
```

## 📁 项目结构

```
digital-human-component/
├── src/                          # 源代码（使用这个！）
│   ├── DigitalHuman.js          # 主类
│   ├── modules/                 # 功能模块
│   ├── config/defaults.js       # 默认配置
│   └── utils/                   # 工具函数
├── cdn/                         # 构建输出和资源
│   ├── animations/              # 默认动画（自动从 CDN 加载）
│   └── images/                  # 默认图片（自动从 CDN 加载）
├── examples/
│   └── index.html               # 完整示例
└── README.md
```

## 🎭 场景模式说明

### 聆听模式

- **基础动画**：F_Standing_Idle_001（站立待机）
- **微表情**：
  - 随机眨眼（每 3-6 秒）
  - 随机微笑（持续 3-5 秒，间隔 15-30 秒）
  - 随机点头（间隔 15-30 秒）
  - 随机挑眉（间隔 20-40 秒）
  - 随机歪头（间隔 25-45 秒）

### 说话模式

- **基础动画**：F_Talking_Variations_005（说话动画）
- **唇形同步**：基于 FFT 音频分析的实时音素检测
- **微表情**：随机眨眼

## ❓ 常见问题

### 1. 为什么不能直接双击 HTML 文件打开？

**原因**：浏览器安全策略不允许 `file://` 协议加载 ES6 模块。

**解决方案**：使用本地服务器（见"快速开始"）

### 2. 修改代码后没有生效？

**原因**：浏览器缓存了旧文件。

**解决方案**：强制刷新 `Ctrl+Shift+R` (Windows/Linux) 或 `Cmd+Shift+R` (Mac)

### 3. 模型不动？

**检查**：
- 浏览器控制台是否有错误？
- 是否看到"✅ Animation loaded successfully"日志？
- 是否通过本地服务器访问（不是 file:// 协议）？

### 4. 唇形同步不准确？

**优化建议**：
- 使用清晰的音频文件（采样率 ≥ 16kHz）
- 确保音频格式为 wav 或 mp3
- 减少背景噪音

## 🌐 默认资源（自动从 CDN 加载）

组件会自动从以下 CDN 加载默认资源，无需手动下载：

- **Idle 动画**：`https://cdn.jsdelivr.net/gh/zizaijiyihu/digital-human-component@latest/cdn/animations/F_Standing_Idle_001.glb`
- **Talking 动画**：`https://cdn.jsdelivr.net/gh/zizaijiyihu/digital-human-component@latest/cdn/animations/F_Talking_Variations_005.glb`
- **默认背景**：`https://cdn.jsdelivr.net/gh/zizaijiyihu/digital-human-component@latest/cdn/images/办公背景.png`

如果你想使用自己的动画或背景，只需在配置中指定 URL 即可。

## 📋 完整示例

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>数字人示例</title>
    <style>
        body {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
            background: #f0f0f0;
        }
        #avatar { width: 600px; height: 600px; }
        button {
            margin: 10px 5px;
            padding: 10px 20px;
            font-size: 16px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <h1>我的数字人</h1>
    <div id="avatar"></div>
    <div>
        <button onclick="avatar.startListening()">👂 聆听模式</button>
        <button onclick="avatar.speak('audio/test.wav')">🗣️ 播放音频</button>
        <button onclick="avatar.stopListening()">⏹ 停止</button>
    </div>

    <script type="importmap">
    {
        "imports": {
            "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
            "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
        }
    }
    </script>

    <script type="module">
        import { DigitalHuman } from './src/index.js';

        window.avatar = new DigitalHuman({
            container: '#avatar',
            modelUrl: 'https://models.readyplayer.me/690abee256dbb2e94779a60a.glb',
            autoStart: 'listening',

            onReady: () => console.log('✅ 准备就绪'),
            onSpeakEnd: () => avatar.startListening()
        });
    </script>
</body>
</html>
```

## 🎓 学习资源

- [Three.js 官方文档](https://threejs.org/)
- [Ready Player Me](https://readyplayer.me/)
- [项目 GitHub](https://github.com/zizaijiyihu/digital-human-component)

## 📄 许可证

MIT

## 🙏 致谢

- [Three.js](https://threejs.org/) - 3D 渲染引擎
- [Ready Player Me](https://readyplayer.me/) - 数字人模型平台
