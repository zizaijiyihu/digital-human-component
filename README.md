# Digital Human Component

一个基于 Three.js 和 Ready Player Me 的数字人组件，支持音频驱动的唇形同步和自然的微表情动画。

## ✨ 特性

- 🎭 **两种场景模式**
  - 聆听模式：idle 动画 + 随机微表情（眨眼、微笑3-5秒、点头、挑眉、歪头）
  - 说话模式：talking 动画 + 音素驱动的唇形同步

- 💬 **智能唇形同步**
  - 基于 FFT 音频分析的音素检测
  - 支持 ARKit 标准 viseme 映射
  - 🆕 支持流式音频（大模型 TTS 实时返回）
  - 🆕 支持麦克风实时驱动

- 🎨 **开箱即用**
  - 默认动画和背景图片（办公背景）
  - 自动从 CDN 加载资源
  - 内置加载动画
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

        // 创建数字人（零配置！只需指定容器）
        const avatar = new DigitalHuman({
            container: '#avatar'
            // 就这一行！其他都有默认值：
            // - 默认模型（Ready Player Me 女性角色）
            // - 默认动画（idle + talking）
            // - 默认背景（办公场景）
        });

        // 播放音频（可选）
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

    // === 可选项（都有默认值）===
    modelUrl: 'https://...',           // Ready Player Me 模型 URL（默认提供）
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

    // 加载动画
    showLoading: true,                 // 显示内置加载动画（默认 true）

    // 事件回调
    onLoadingStart: () => {},          // 加载开始（可选，用于自定义加载效果）
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

// 🆕 流式音频（支持大模型 TTS 实时返回）
const controller = await avatar.speakStreaming({
    audioStream: audioStreamGenerator(),  // 异步生成器或函数
    onChunkReceived: (chunk) => {
        console.log('收到音频片段:', chunk.byteLength);
    },
    onStreamEnd: () => {
        console.log('流结束');
    }
});

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
│   │   ├── LipSyncEngine.js    # 唇形同步引擎（支持流式）
│   │   └── AudioStreamQueue.js  # 🆕 流式音频队列管理
│   ├── config/defaults.js       # 默认配置
│   └── utils/                   # 工具函数
├── cdn/                         # 构建输出和资源
│   ├── animations/              # 默认动画（自动从 CDN 加载）
│   └── images/                  # 默认图片（自动从 CDN 加载）
├── examples/
│   └── index.html               # 完整示例（包含所有功能）
└── README.md
```

## 🎙️ 流式音频使用指南（新功能）

### 什么是流式音频？

流式音频允许你在大模型 TTS 返回音频片段时，**实时驱动数字人嘴形同步**，无需等待完整音频生成完毕。这对于需要低延迟交互的应用场景非常有用。

### 使用方法

#### 方式 1：使用异步生成器

```javascript
// 定义音频流生成器
async function* fetchTTSStream(text) {
    const response = await fetch('https://your-tts-api.com/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });

    const reader = response.body.getReader();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // value 是 Uint8Array，转为 ArrayBuffer
        yield value.buffer;
    }
}

// 使用流式音频
const controller = await avatar.speakStreaming({
    audioStream: fetchTTSStream('你好，我是数字人'),
    onChunkReceived: (chunk) => {
        console.log('收到音频片段:', chunk.byteLength, 'bytes');
    },
    onStreamEnd: () => {
        console.log('流式音频播放完成');
        // 可以自动切换到聆听模式
        avatar.startListening();
    }
});

// 可以随时停止
// controller.stop();
```

#### 方式 2：手动推送音频片段

```javascript
// 创建一个空的流控制器
const controller = await avatar.speakStreaming({
    audioStream: async function* () {
        // 空生成器，手动推送
    }
});

// 当收到音频片段时，手动推送
websocket.onmessage = async (event) => {
    const audioChunk = await event.data.arrayBuffer();
    await controller.enqueueAudio(audioChunk);
};
```

#### 完整集成示例（OpenAI TTS）

```javascript
import { DigitalHuman } from './src/index.js';

const avatar = new DigitalHuman({
    container: '#avatar',
    autoStart: 'listening'
});

// OpenAI TTS 流式集成
async function speakWithOpenAI(text) {
    async function* openAITTSStream() {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${YOUR_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'tts-1',
                voice: 'alloy',
                input: text,
                response_format: 'pcm'  // 原始 PCM 音频
            })
        });

        const reader = response.body.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            yield value.buffer;
        }
    }

    await avatar.speakStreaming({
        audioStream: openAITTSStream(),
        onStreamEnd: () => {
            avatar.startListening();
        }
    });
}

// 使用
await speakWithOpenAI('你好，很高兴见到你！');
```

### API 参数说明

```javascript
avatar.speakStreaming({
    // 必填：音频流生成器或函数
    audioStream: asyncGenerator | function,

    // 可选：采样率（默认 16000）
    sampleRate: 16000,

    // 可选：收到音频片段的回调
    onChunkReceived: (chunk) => {
        // chunk 是 ArrayBuffer
    },

    // 可选：流结束的回调
    onStreamEnd: () => {
        // 流播放完成
    }
})
```

### 返回的控制对象

```javascript
const controller = await avatar.speakStreaming({...});

// 停止播放
controller.stop();

// 检查是否正在播放
const isPlaying = controller.isPlaying();

// 手动添加音频片段（仅限方式 2）
await controller.enqueueAudio(audioChunkArrayBuffer);
```

### 音频格式要求

- **支持格式**：
  - ✅ WAV, MP3, OGG 等标准格式
  - ✅ **PCM 原始格式（自动转换）** - 大模型 TTS 常用格式
- **推荐采样率**：≥ 16kHz（推荐 16kHz 或 24kHz）
- **片段大小**：建议每个片段 100-500ms 的音频数据
- **编码**：PCM 或压缩格式均可（会自动解码）

#### PCM 音频支持（新功能）

组件已内置 **PCM 自动检测和转换**功能！大模型 TTS 通常返回纯 PCM 格式，无需手动处理：

```javascript
await avatar.speakStreaming({
    audioStream: fetchPCMStream(),  // 后端返回 PCM 流

    // 指定 PCM 参数（与后端一致）
    sampleRate: 16000,   // 采样率
    numChannels: 1,      // 声道数
    bitDepth: 16         // 位深度
});
```

详见 [PCM 音频处理指南](docs/PCM_AUDIO_GUIDE.md)

### 注意事项

1. **浏览器兼容性**：需要支持 Web Audio API 的现代浏览器
2. **CORS 设置**：如果音频来自外部 API，确保服务器设置了正确的 CORS 头
3. **延迟优化**：片段越小延迟越低，但过小会增加网络开销
4. **错误处理**：建议添加 `onError` 回调处理网络或解码错误

### 完整示例

查看 [examples/index.html](examples/index.html) 获取完整的可运行示例，包含：
- ✅ 传统音频文件播放
- ✅ 流式音频驱动（大模型 TTS）
- ✅ 麦克风实时驱动（新功能）

---

## 🎤 麦克风实时驱动（新功能）

### 什么是麦克风实时驱动？

使用你的麦克风实时捕获声音，让数字人的嘴形**实时跟随你的语音同步**。这是最直观、最具互动性的使用方式！

### 快速开始

```javascript
import { DigitalHuman } from './src/index.js';

const avatar = new DigitalHuman({
    container: '#avatar'
});

// 请求麦克风权限
const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
        echoCancellation: true,   // 回音消除
        noiseSuppression: true,   // 降噪
        autoGainControl: true     // 自动增益控制
    }
});

// 创建音频上下文和分析器
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048;

// 连接麦克风到分析器
const micSource = audioContext.createMediaStreamSource(stream);
micSource.connect(analyser);

// 启动说话模式
avatar.animationController.play('talking');
avatar.expressionManager.startSpeakingMode();
avatar.currentMode = 'speaking';

// 启动实时唇形同步
avatar.lipSyncEngine.startStreaming(analyser, audioContext);

// 对着麦克风说话，数字人会实时同步你的嘴形！
```

### 在线演示

访问 [examples/index.html](examples/index.html) 体验完整功能：
- 🎤 一键开始录音驱动
- 📊 实时音量可视化显示
- 💬 完美的嘴形同步
- ⚡ 零延迟驱动

### 停止麦克风驱动

```javascript
// 停止媒体流
stream.getTracks().forEach(track => track.stop());

// 断开音频源
micSource.disconnect();

// 关闭音频上下文
audioContext.close();

// 停止唇形同步和说话模式
avatar.lipSyncEngine.stop();
avatar.animationController.stop('talking');
avatar.expressionManager.stopSpeakingMode();
```

### 注意事项

1. **浏览器权限**：首次使用需要授予麦克风权限
2. **HTTPS 要求**：生产环境必须使用 HTTPS（本地开发可用 HTTP）
3. **浏览器支持**：需要支持 `getUserMedia` API 的现代浏览器
4. **回音消除**：建议启用 `echoCancellation: true` 避免回声
5. **资源清理**：使用完毕后务必停止 MediaStream 和关闭 AudioContext

---

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
- **支持模式**：
  - ✅ 传统模式：完整音频文件（URL、Blob、ArrayBuffer）
  - ✅ 流式模式：实时音频流（支持大模型 TTS）
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

### 4. 如何自定义加载动画？

**方式一：禁用内置加载动画**
```javascript
const avatar = new DigitalHuman({
    container: '#avatar',
    showLoading: false  // 禁用内置加载动画
});
```

**方式二：使用回调自定义**
```javascript
const avatar = new DigitalHuman({
    container: '#avatar',
    onLoadingStart: () => {
        // 显示你的自定义加载效果
        document.getElementById('my-loader').style.display = 'block';
    },
    onReady: () => {
        // 隐藏你的自定义加载效果
        document.getElementById('my-loader').style.display = 'none';
    }
});
```

### 5. 唇形同步不准确？

**优化建议**：
- 使用清晰的音频文件（采样率 ≥ 16kHz）
- 确保音频格式为 wav 或 mp3
- 减少背景噪音

## 🌐 默认资源（自动从 CDN 加载）

组件会自动从以下 CDN 加载默认资源，无需手动下载：

- **默认模型**：`https://models.readyplayer.me/690abee256dbb2e94779a60a.glb`（Ready Player Me 女性角色）
- **Idle 动画**：`https://cdn.jsdelivr.net/gh/zizaijiyihu/digital-human-component@latest/cdn/animations/F_Standing_Idle_001.glb`
- **Talking 动画**：`https://cdn.jsdelivr.net/gh/zizaijiyihu/digital-human-component@latest/cdn/animations/F_Talking_Variations_005.glb`
- **默认背景**：`https://cdn.jsdelivr.net/gh/zizaijiyihu/digital-human-component@latest/cdn/images/office-background.png`

如果你想使用自己的模型、动画或背景，只需在配置中指定 URL 即可。

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

        // 零配置使用！
        window.avatar = new DigitalHuman({
            container: '#avatar',
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
