# Digital Human Component

一个基于 Three.js 和 Ready Player Me 的数字人组件，支持音频驱动的唇形同步和自然的微表情动画。

## 特性

- 🎭 **两种场景模式**
  - **聆听模式**：基于 idle 动画 + 随机微表情（眨眼、微笑、点头、挑眉、歪头）
  - **说话模式**：基于 talking 动画 + 音素驱动的唇形同步

- 💬 **智能唇形同步**
  - 基于 FFT 音频分析的音素检测
  - 支持 ARKit 标准 viseme 映射
  - 自然的嘴部开合节奏

- 🎨 **灵活配置**
  - 自定义背景颜色或图片
  - 使用默认 CDN 动画或自定义动画
  - 可配置相机位置和视角
  - 丰富的事件回调

## 快速开始

### 方法一：使用 CDN（推荐用于生产环境）

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

    <!-- 引入 Three.js -->
    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>

    <!-- 引入 Digital Human Component -->
    <script src="https://cdn.jsdelivr.net/gh/zizaijiyihu/digital-human-component@latest/cdn/digital-human.min.js"></script>

    <script>
        const avatar = new DigitalHuman.DigitalHuman({
            container: '#avatar',
            modelUrl: 'https://models.readyplayer.me/690abee256dbb2e94779a60a.glb',
            autoStart: 'listening',
            onReady: () => {
                console.log('数字人已准备就绪！');
            }
        });

        // 播放音频并开始说话
        function speak() {
            avatar.speak('https://example.com/audio.wav').then(() => {
                console.log('说话完成');
                avatar.startListening(); // 切换回聆听模式
            });
        }
    </script>
</body>
</html>
```

### 方法二：本地开发（使用源码）

由于浏览器的 CORS 安全策略，需要通过本地服务器运行示例：

#### 1. 启动本地服务器

**选项 A：使用 Python 3（推荐，无需安装依赖）**

```bash
# 进入项目目录
cd /path/to/digital-human-component

# 启动服务器（端口 8000）
python3 -m http.server 8000

# 或者使用 Python 2（如果只有 Python 2）
python -m SimpleHTTPServer 8000
```

启动成功后会看到：
```
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

**选项 B：使用 Node.js**

```bash
# 全局安装 http-server
npm install -g http-server

# 在项目目录启动服务器
cd /path/to/digital-human-component
http-server -p 8000
```

**选项 C：使用 PHP（如果已安装 PHP）**

```bash
cd /path/to/digital-human-component
php -S localhost:8000
```

#### 2. 访问示例页面

在浏览器中打开：
```
http://localhost:8000/examples/basic.html
```

**注意**：
- ⚠️ 不要使用 `file://` 协议直接打开 HTML 文件，否则会遇到 CORS 错误！
- ✅ 必须通过 `http://localhost` 访问才能正常加载 ES6 模块
- 🔄 如果遇到模块导入错误，请强制刷新浏览器：`Ctrl+Shift+R` (Windows/Linux) 或 `Cmd+Shift+R` (Mac)
- 🛑 停止服务器：在终端按 `Ctrl + C`

### 方法三：使用构建后的文件

如果不想启动开发服务器，可以使用构建后的 UMD 版本：

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

    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
    <script src="cdn/digital-human.min.js"></script>

    <script>
        const avatar = new DigitalHuman.DigitalHuman({
            container: '#avatar',
            modelUrl: 'https://models.readyplayer.me/690abee256dbb2e94779a60a.glb',
            backgroundImage: 'cdn/images/办公背景.png',
            autoStart: 'listening',
            onReady: () => console.log('Ready!')
        });
    </script>
</body>
</html>
```

## API 文档

### 构造函数选项

```javascript
new DigitalHuman({
    // 必填项
    container: '#avatar',              // 容器选择器或 DOM 元素

    // 模型配置
    modelUrl: 'path/to/model.glb',     // Ready Player Me 模型 URL

    // 动画配置
    useDefaultAnimations: true,         // 是否使用默认 CDN 动画
    animations: {
        idle: 'path/to/idle.glb',      // 自定义 idle 动画（可选）
        talking: 'path/to/talk.glb'    // 自定义 talking 动画（可选）
    },

    // 背景配置
    backgroundColor: '#1a1a2e',         // 背景颜色
    backgroundImage: 'path/to/bg.png', // 背景图片（可选）

    // 行为配置
    autoStart: 'listening',             // 自动启动模式：'listening' | 'speaking' | null
    enableBlinking: true,               // 是否启用眨眼

    // 事件回调
    onReady: () => {},                  // 模型加载完成
    onSpeakStart: () => {},             // 开始说话
    onSpeakEnd: () => {},               // 说话结束
    onListeningStart: () => {},         // 开始聆听
    onError: (error) => {}              // 错误处理
});
```

### 方法

#### `speak(audio)`
播放音频并开始说话模式。

```javascript
// 使用音频 URL
avatar.speak('https://example.com/audio.wav');

// 使用 Blob
const audioBlob = new Blob([audioData], { type: 'audio/wav' });
avatar.speak(audioBlob);

// 使用 ArrayBuffer
avatar.speak(audioArrayBuffer);

// 使用 Promise
avatar.speak('audio.wav').then(() => {
    console.log('说话完成');
    avatar.startListening();
});
```

#### `startListening()`
切换到聆听模式。

```javascript
avatar.startListening();
```

#### `stopListening()`
停止聆听模式。

```javascript
avatar.stopListening();
```

#### `dispose()`
清理资源。

```javascript
avatar.dispose();
```

## 场景模式说明

### 聆听模式（Listening Mode）

- **基础动画**：F_Standing_Idle_001（站立待机动画）
- **微表情**：
  - 随机眨眼（每 3-6 秒）
  - 随机微笑（持续 3-5 秒，15-30 秒间隔）
  - 随机点头（15-30 秒间隔）
  - 随机挑眉（20-40 秒间隔）
  - 随机歪头（25-45 秒间隔）

### 说话模式（Speaking Mode）

- **基础动画**：F_Talking_Variations_005（说话动画）
- **唇形同步**：基于 FFT 音频分析的实时音素检测
- **微表情**：随机眨眼（每 3-6 秒）

## 项目结构

```
digital-human-component/
├── src/                          # 源代码
│   ├── DigitalHuman.js          # 主类
│   ├── modules/                 # 功能模块
│   │   ├── SceneManager.js      # 场景管理
│   │   ├── AnimationController.js # 动画控制
│   │   ├── LipSyncEngine.js     # 唇形同步引擎
│   │   └── ExpressionManager.js # 表情管理
│   ├── config/
│   │   └── defaults.js          # 默认配置
│   └── utils/
│       └── EventEmitter.js      # 事件系统
├── cdn/                         # 构建输出和资源
│   ├── digital-human.js         # UMD 版本
│   ├── digital-human.min.js     # UMD 压缩版
│   ├── digital-human.esm.js     # ES Module 版本
│   ├── animations/              # 默认动画
│   └── images/                  # 默认图片
├── examples/                    # 示例
│   ├── basic.html              # 基础示例
│   └── audio/                  # 测试音频
└── README.md                   # 说明文档
```

## 开发

### 安装依赖

```bash
npm install
```

### 构建

```bash
npm run build
```

生成三个版本：
- `cdn/digital-human.js` - UMD 格式（可在浏览器直接使用）
- `cdn/digital-human.min.js` - UMD 压缩版
- `cdn/digital-human.esm.js` - ES Module 格式（用于打包工具）

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

需要支持：
- ES6 Modules
- Web Audio API
- WebGL

## 常见问题

### 1. CORS 错误：`Cross origin requests are only supported for protocol schemes`

**原因**：浏览器不允许 `file://` 协议加载 ES6 模块。

**解决方案**：
- 使用本地服务器（参见"快速开始 - 方法二"）
- 或使用构建后的 UMD 版本（`cdn/digital-human.min.js`）

### 2. 模块导入错误：`Failed to resolve module specifier`

**原因**：浏览器缓存了旧版本的文件。

**解决方案**：
- 强制刷新浏览器：`Ctrl+Shift+R` (Windows/Linux) 或 `Cmd+Shift+R` (Mac)
- 或在开发者工具中禁用缓存（Console → Settings → Disable cache）

### 3. 模型加载失败

**检查**：
- Ready Player Me 模型 URL 是否正确
- 模型是否包含 ARKit 标准的 morph targets
- 网络连接是否正常

### 4. 唇形同步不准确

**优化建议**：
- 使用清晰的音频文件（采样率 ≥ 16kHz）
- 确保音频格式为 wav 或 mp3
- 检查音频是否包含背景噪音

### 5. 动画不流畅

**优化建议**：
- 检查 GPU 性能
- 降低模型复杂度
- 使用压缩后的 GLB 动画文件

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 致谢

- [Three.js](https://threejs.org/) - 3D 渲染引擎
- [Ready Player Me](https://readyplayer.me/) - 数字人模型平台
- 基于原始 Virtual Teacher 项目重构
