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
- ✅ 麦克风实时驱动
- ✅ 视频通话模式
- ✅ 视频自动采集（最新功能）

---

## 📹 视频通话模式（新功能）

### 什么是视频通话模式？

视频通话模式将数字人与您的摄像头画面结合，创造类似视频会议的体验。您可以：
- 🎥 同时显示数字人和本地摄像头画面
- 🔄 灵活切换主窗口和小窗口
- 📊 实时音频可视化效果
- 🖱️ 点击小窗口即可切换

### 快速开始

```javascript
import { DigitalHuman } from './src/index.js';

const avatar = new DigitalHuman({
    container: '#avatar'
});

// 进入视频通话模式
await avatar.enterVideoCallMode({
    pipPosition: 'bottom-right',      // 小窗口位置：'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
    pipScale: 0.25,                    // 小窗口缩放比例，默认 0.25 (1/4)
    showLocalVideo: true,              // 是否显示本地摄像头，默认 true
    showAudioVisualizer: true          // 是否显示音频可视化，默认 true
});

// 退出视频通话模式
avatar.exitVideoCallMode();
```

### 窗口切换功能

视频通话模式支持灵活的窗口切换，有两种方式：

#### 方式 1：点击小窗口切换（UI 交互）
```javascript
// 进入视频通话模式后，直接点击小窗口即可切换
// - 初始：摄像头主窗口 + 数字人小窗口
// - 点击后：数字人主窗口 + 摄像头小窗口
// - 再次点击：切换回初始状态
```

#### 方式 2：代码调用切换
```javascript
// 直接调用切换方法
await avatar.toggleWindowSize();

// 或者指定切换参数
await avatar.toggleWindowSize({
    pipPosition: 'top-left',           // 改变小窗口位置
    pipScale: 0.3,                      // 改变小窗口大小
    showAudioVisualizer: false          // 关闭音频可视化
});
```

### 完整示例

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        #avatar {
            width: 800px;
            height: 600px;
            position: relative;  /* 重要：确保容器支持绝对定位 */
        }
    </style>
</head>
<body>
    <div id="avatar"></div>
    <button id="btnEnter">进入视频通话</button>
    <button id="btnExit">退出视频通话</button>
    <button id="btnToggle">切换窗口</button>

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

        const avatar = new DigitalHuman({
            container: '#avatar'
        });

        // 进入视频通话模式
        document.getElementById('btnEnter').addEventListener('click', async () => {
            try {
                await avatar.enterVideoCallMode({
                    pipPosition: 'bottom-right',
                    pipScale: 0.25,
                    showLocalVideo: true,
                    showAudioVisualizer: true
                });
                console.log('已进入视频通话模式');
            } catch (error) {
                console.error('进入失败:', error);
                alert('无法访问摄像头/麦克风，请检查浏览器权限设置');
            }
        });

        // 退出视频通话模式
        document.getElementById('btnExit').addEventListener('click', () => {
            avatar.exitVideoCallMode();
            console.log('已退出视频通话模式');
        });

        // 切换窗口大小
        document.getElementById('btnToggle').addEventListener('click', async () => {
            await avatar.toggleWindowSize();
            console.log('窗口已切换');
        });
    </script>
</body>
</html>
```

### 音频可视化效果

视频通话模式内置了精美的音频可视化效果：
- 🌊 **超平滑波浪线**：使用 Catmull-Rom 样条插值，无锯齿感
- 🎨 **渐变色彩**：浅蓝色渐变，透明度自然过渡
- 📊 **实时响应**：根据麦克风音量动态调整波形幅度
- ⚡ **高性能**：优化的渲染算法，流畅无卡顿

可以通过配置控制是否显示：
```javascript
// 进入时关闭音频可视化
await avatar.enterVideoCallMode({
    showAudioVisualizer: false
});

// 切换时关闭音频可视化
await avatar.toggleWindowSize({
    showAudioVisualizer: false
});
```

### API 说明

#### enterVideoCallMode(options)
进入视频通话模式

**参数：**
```javascript
{
    pipPosition: 'bottom-right',       // 小窗口位置
    pipScale: 0.25,                     // 小窗口缩放比例 (0.1 - 1.0)
    showLocalVideo: true,               // 是否显示本地摄像头
    showAudioVisualizer: true           // 是否显示音频可视化
}
```

**返回：** `Promise<MediaStream>` - 本地媒体流

#### exitVideoCallMode()
退出视频通话模式，停止所有媒体流

#### toggleWindowSize(options)
切换主窗口和小窗口

**参数：**
```javascript
{
    pipPosition: 'bottom-right',       // 小窗口位置（可选）
    pipScale: 0.25,                     // 小窗口缩放比例（可选）
    showAudioVisualizer: true           // 是否显示音频可视化（可选）
}
```

**返回：** `Promise<void>`

### 事件监听

```javascript
// 进入视频通话模式
avatar.on('videoCallEnter', ({ stream }) => {
    console.log('进入视频通话模式', stream);
});

// 退出视频通话模式
avatar.on('videoCallExit', () => {
    console.log('退出视频通话模式');
});

// 窗口大小切换
avatar.on('windowSizeToggle', ({ isSmallWindow, config }) => {
    console.log('窗口已切换', { isSmallWindow, config });
});

// 视频通话错误
avatar.on('videoCallError', ({ error }) => {
    console.error('视频通话错误', error);
});
```

### 注意事项

1. **容器样式要求**：
   - 容器必须有明确的宽高
   - 容器需要 `position: relative` 以支持绝对定位的子元素

2. **浏览器权限**：
   - 首次使用需要授予摄像头和麦克风权限
   - 生产环境必须使用 HTTPS（本地开发可用 HTTP）

3. **浏览器兼容性**：
   - 需要支持 `getUserMedia` API
   - 需要支持 Web Audio API
   - 推荐使用 Chrome、Edge、Firefox、Safari 最新版

4. **性能优化**：
   - 视频分辨率默认为 1280x720
   - 音频可视化使用优化的 FFT 算法
   - 窗口切换采用 CSS3 过渡动画

5. **资源清理**：
   - 退出视频通话模式时会自动停止所有媒体流
   - 页面卸载时建议调用 `avatar.destroy()` 清理资源

---

## 🎬 视频自动采集（最新功能 - 分组录制架构）

### 什么是视频自动采集？

视频自动采集功能采用**分组录制架构**，自动录制用户说话的视频片段，包含：
- 📹 **说话前的 N 组视频**（默认 2 组，每组 5 秒，可自定义）
- 🗣️ **说话期间的 1 组视频**（完整录制说话过程）
- 💾 自动将视频组数组传递给回调函数处理（上传/保存等）
- ✅ **每个视频组都是完整可播放的 WebM 文件**（包含 header）

### 使用场景

- 💬 **视频客服**：自动记录用户咨询视频
- 🎓 **在线教育**：记录学生回答问题的视频
- 🏥 **远程医疗**：记录患者描述症状的视频
- 📊 **用户研究**：收集用户反馈视频

### 快速开始

```javascript
import { DigitalHuman } from './src/index.js';

const avatar = new DigitalHuman({ container: '#avatar' });

// 1. 进入视频通话模式（必须）
await avatar.enterVideoCallMode();

// 2. 启动视频自动采集
await avatar.enableVideoAutoCapture({
    // 必选：视频捕获回调（接收视频组数组）
    onVideoCapture: (videoGroups) => {
        console.log(`捕获到 ${videoGroups.length} 个视频组`);

        // videoGroups 是数组，每个元素包含：
        // - blob: Blob (视频数据)
        // - duration: number (时长，毫秒)
        // - startTime: number (开始时间戳)
        // - endTime: number (结束时间戳)
        // - size: number (文件大小，字节)
        // - type: string ('before-speaking' 或 'speaking')

        videoGroups.forEach((group, index) => {
            console.log(`视频组 ${index + 1}:`, {
                type: group.type,
                duration: `${(group.duration / 1000).toFixed(1)}s`,
                size: `${(group.size / 1024 / 1024).toFixed(2)} MB`
            });

            // 上传每个视频组到服务器
            const formData = new FormData();
            formData.append('video', group.blob, `video-${index + 1}.webm`);
            formData.append('type', group.type);
            formData.append('duration', group.duration);

            fetch('/api/upload-video', {
                method: 'POST',
                body: formData
            });
        });
    },

    // ===== 视频录制配置 =====
    maxGroups: 2,                   // 保留的视频组数量（默认 2 组）
    groupDuration: 5000,            // 每组视频时长（默认 5000ms = 5 秒）
    maxRecordDuration: 300000,      // 最大录制时长（默认 300000ms = 5 分钟）
    videoFormat: 'video/webm',      // 视频格式（默认 'video/webm'）
    videoBitsPerSecond: 2500000,    // 视频比特率（默认 2500000 = 2.5 Mbps）

    // ===== VAD（语音活动检测）配置 =====
    // 🆕 智能 VAD：动态自适应阈值 + 预激活机制
    // - 自动校准：启动后 3 秒自动检测环境噪音，无需手动设置阈值
    // - 预激活机制：低能量也能触发预激活，能量持续上升则确认为说话
    // - 三状态机：IDLE（待机）→ PRE_ACTIVE（预激活）→ SPEAKING（说话中）

    speechThreshold: 30,            // 基础阈值（仅用于未校准时，默认 30）
                                    // 实际阈值 = 背景噪音基准 × 倍数（自动计算）

    silenceDuration: 2000,          // 静音持续时间（默认 2000ms）
                                    // 检测到静音后，持续多久才认为说话结束

    minSpeakDuration: 900,          // 最小说话时长（默认 900ms）
                                    // 过滤太短的声音（避免误触发）

    // ===== VAD 高级配置（可选，一般不需要修改）=====
    calibrationDuration: 3000,      // 校准时长（默认 3000ms = 3 秒）
                                    // 启动后的校准时间，用于采样背景噪音

    noiseUpdateInterval: 10000,     // 噪音基准更新间隔（默认 10000ms = 10 秒）
                                    // 定期重新采样背景噪音，适应环境变化

    minThreshold: 20,               // 动态阈值的最小值（默认 20）
                                    // 确保即使在极安静环境下，阈值也不会太低

    lowThresholdMultiplier: 1.5,    // 预激活阈值倍数（默认 1.5）
                                    // 预激活阈值 = max(背景噪音基准 × 1.5, minThreshold)

    highThresholdMultiplier: 3.0,   // 确认阈值倍数（默认 3.0）
                                    // 确认说话阈值 = max(背景噪音基准 × 3.0, minThreshold × 1.5)

    // ===== 回调函数 =====
    onSpeakingStart: () => {
        console.log('检测到说话开始');
    },
    onSpeakingEnd: () => {
        console.log('检测到说话结束');
    },
    onError: (error) => {
        console.error('采集错误:', error);
    }
});

// 3. 停止视频自动采集
avatar.disableVideoAutoCapture();
```

### 工作原理（分组录制架构）

```
时间轴： 0s ──── 5s ──── 10s ──── 15s ──── 说话 ──── 结束
         [组#1]  [组#2]  [组#3]  [组#4]
          ↓       ↓       ↓       ↓
      每 5 秒 MediaRecorder 重启一次（生成新 header）
      每组都是完整可播放的 WebM 文件

循环保留最近 N 组（默认 2 组）：
时间： 0s ──── 5s ──── 10s ──── 15s
       [组#1]  [组#2]  [组#3]  [组#4]
        删除    删除    保留    保留 ← 循环缓冲区

检测到说话开始 🗣️
    ↓
快照说话前的 N 组 + 录制说话期间的 1 组
    ↓
说话结束 🔇
    ↓
传递视频组数组给回调：
[
  { blob, type: 'before-speaking', duration: 5000ms },  ← 说话前的组 #1
  { blob, type: 'before-speaking', duration: 5000ms },  ← 说话前的组 #2
  { blob, type: 'speaking', duration: 8000ms }          ← 说话期间的组
]
    ↓
清空已捕获的视频组（防止重复）
```

### API 文档

#### enableVideoAutoCapture(options)
启动视频自动采集

**参数：**
```javascript
{
    // ===== 必选参数 =====
    onVideoCapture: (videoGroups) => {},  // 视频捕获回调（接收视频组数组）

    // ===== 视频录制配置 =====
    maxGroups: 2,                   // 保留的视频组数量，默认 2
    groupDuration: 5000,            // 每组视频时长（毫秒），默认 5000
    maxRecordDuration: 300000,      // 最大录制时长（毫秒），默认 300000（5分钟）
    videoFormat: 'video/webm',      // 视频格式，默认 'video/webm'
    videoBitsPerSecond: 2500000,    // 视频比特率，默认 2500000（2.5 Mbps）

    // ===== VAD（语音活动检测）配置 =====
    // 🆕 智能 VAD：动态自适应阈值 + 预激活机制
    speechThreshold: 30,            // 基础阈值（仅用于未校准时），默认 30
    silenceDuration: 2000,          // 静音持续时间（毫秒），默认 2000
    minSpeakDuration: 900,          // 最小说话时长（毫秒），默认 900

    // ===== VAD 高级配置（可选）=====
    calibrationDuration: 3000,      // 校准时长（毫秒），默认 3000
    noiseUpdateInterval: 10000,     // 噪音基准更新间隔（毫秒），默认 10000
    minThreshold: 20,               // 动态阈值的最小值，默认 20
    lowThresholdMultiplier: 1.5,    // 预激活阈值倍数，默认 1.5
    highThresholdMultiplier: 3.0,   // 确认阈值倍数，默认 3.0

    // ===== 可选回调 =====
    onSpeakingStart: () => {},      // 说话开始回调
    onSpeakingEnd: () => {},        // 说话结束回调
    onError: (error) => {}          // 错误回调
}
```

**onVideoCapture 回调参数：**
```javascript
// videoGroups: Array<VideoGroup> - 视频组数组
// 每个 VideoGroup 包含：
[
    {
        blob: Blob,                   // 视频数据（WebM 格式，可直接播放）
        duration: 5000,              // 视频时长（毫秒）
        startTime: 1699999999999,    // 开始时间戳
        endTime: 1700000004999,      // 结束时间戳
        size: 1048576,               // 文件大小（字节）
        type: 'before-speaking'      // 类型：'before-speaking' 或 'speaking'
    },
    {
        blob: Blob,
        duration: 8000,
        startTime: 1700000004999,
        endTime: 1700000012999,
        size: 2097152,
        type: 'speaking'
    }
]
```

**返回：** `Promise<void>`

**异常：**
- 如果不在视频通话模式下调用，会抛出错误
- 如果未提供 `onVideoCapture` 回调，会抛出错误

#### disableVideoAutoCapture()
停止视频自动采集

**返回：** `void`

#### getVideoAutoCaptureStatus()
获取视频自动采集状态

**返回：** `Object|null`
```javascript
{
    isRunning: true,              // 是否正在运行
    isRecording: false,           // 是否正在录制
    groupCount: 1,                // 当前保留的视频组数量
    currentEnergy: 25.5,          // 当前音频能量值
    threshold: 40,                // 说话检测阈值
    isSpeaking: false             // 是否正在说话
}
```

#### getAllVideoGroups()
获取当前所有视频组（随时调用）

**返回：** `Array<VideoGroup>`
```javascript
[
    {
        blob: Blob,               // 视频数据
        duration: 5000,          // 时长（毫秒）
        startTime: 1699999999999,
        endTime: 1700000004999,
        size: 1048576,
        isRecording: false       // 是否正在录制中
    }
]
```

### 完整示例

```javascript
import { DigitalHuman } from './src/index.js';

const avatar = new DigitalHuman({
    container: '#avatar',
    debug: true
});

// 进入视频通话模式
await avatar.enterVideoCallMode({
    pipPosition: 'bottom-right',
    pipScale: 0.25,
    showAudioVisualizer: true
});

// 启动视频自动采集
await avatar.enableVideoAutoCapture({
    // 视频录制配置
    maxGroups: 2,             // 保留 2 组视频（默认 2）
    groupDuration: 5000,      // 每组 5 秒（默认 5000ms）

    // VAD 配置（使用默认值即可，会自动校准）
    speechThreshold: 30,      // 基础阈值（默认 30）
    silenceDuration: 2000,    // 静音持续时间（默认 2000ms）
    minSpeakDuration: 900,    // 最小说话时长（默认 900ms）

    onVideoCapture: async (videoGroups) => {
        console.log(`📹 捕获到 ${videoGroups.length} 个视频组`);

        // 遍历所有视频组
        for (const [index, group] of videoGroups.entries()) {
            console.log(`视频组 ${index + 1}:`, {
                type: group.type,
                duration: `${(group.duration / 1000).toFixed(1)}s`,
                size: `${(group.size / 1024 / 1024).toFixed(2)} MB`
            });

            // 方式 1：下载到本地
            const url = URL.createObjectURL(group.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `video-${index + 1}-${group.type}.webm`;
            a.click();
            URL.revokeObjectURL(url);

            // 方式 2：上传到服务器
            const formData = new FormData();
            formData.append('video', group.blob, `video-${index + 1}.webm`);
            formData.append('type', group.type);
            formData.append('duration', group.duration);

            await fetch('/api/upload-video', {
                method: 'POST',
                body: formData
            });
        }

        console.log('✅ 所有视频已处理');
    },

    onSpeakingStart: () => {
        console.log('🗣️ 用户开始说话');
        document.getElementById('status').textContent = '正在录制...';
    },

    onSpeakingEnd: () => {
        console.log('🔇 用户停止说话');
        document.getElementById('status').textContent = '待机中';
    },

    onError: (error) => {
        console.error('❌ 采集错误:', error);
        alert('视频采集出错: ' + error.message);
    }
});

// 获取采集状态
setInterval(() => {
    const status = avatar.getVideoAutoCaptureStatus();
    if (status) {
        console.log('采集状态:', status);
    }
}, 1000);

// 停止采集
// avatar.disableVideoAutoCapture();
```

### 参数调优建议

#### 1. VAD（语音活动检测）参数

🆕 **智能 VAD 特性**：
- **自动校准**：启动后 3 秒自动检测环境噪音，无需手动设置阈值
- **动态阈值**：根据背景噪音自动调整检测阈值
- **预激活机制**：低能量也能触发预激活，能量持续上升则确认为说话

**speechThreshold（基础阈值）**：
- **默认值**：30（仅用于未校准时）
- **说明**：校准完成后，实际使用动态阈值 = 背景噪音基准 × 倍数
- **调整建议**：
  - 一般情况：使用默认值 30 即可，让 VAD 自动校准
  - 特殊环境：如果自动校准效果不佳，可适当调整基础阈值
  - 可通过 `getVideoAutoCaptureStatus()` 监控实时音频能量和阈值

**lowThresholdMultiplier（预激活阈值倍数）**：
- **默认值**：1.5
- **说明**：预激活阈值 = 背景噪音基准 × 1.5
- **调整建议**：
  - 更敏感（容易触发）：1.2 - 1.4
  - 默认（推荐）：1.5
  - 更保守（减少误触发）：1.6 - 2.0

**highThresholdMultiplier（确认阈值倍数）**：
- **默认值**：3.0
- **说明**：确认说话阈值 = 背景噪音基准 × 3.0
- **调整建议**：
  - 更快确认：2.5 - 2.8
  - 默认（推荐）：3.0
  - 更保守：3.2 - 4.0

**calibrationDuration（校准时长）**：
- **默认值**：3000ms（3 秒）
- **说明**：启动后的校准时间，用于采样背景噪音
- **调整建议**：
  - 环境稳定：2000ms（2 秒）
  - 环境复杂：4000ms - 5000ms（4-5 秒）

**noiseUpdateInterval（噪音基准更新间隔）**：
- **默认值**：10000ms（10 秒）
- **说明**：定期重新采样背景噪音，适应环境变化
- **调整建议**：
  - 环境固定：15000ms - 20000ms
  - 环境多变：5000ms - 8000ms

**minThreshold（动态阈值最小值）**：
- **默认值**：20
- **说明**：确保即使在极安静环境下，阈值也不会太低，避免误触发
- **调整建议**：
  - 更敏感（容易触发）：15 - 18
  - 默认（推荐）：20
  - 更保守（减少误触发）：22 - 25
- **工作原理**：
  - 预激活阈值 = max(背景噪音基准 × 1.5, minThreshold)
  - 确认阈值 = max(背景噪音基准 × 3.0, minThreshold × 1.5)

#### 2. silenceDuration（静音持续时间）
- **默认值**：2000ms
- **说明**：检测到静音后，持续多久才认为说话结束
- **调整建议**：
  - 快节奏对话：1500ms
  - 思考型回答：3000ms
  - 避免过短（会截断句子）或过长（视频过大）

#### 3. minSpeakDuration（最小说话时长）
- **默认值**：900ms
- **说明**：过滤太短的声音，避免误触发
- **调整建议**：
  - 更敏感：600ms - 800ms
  - 默认（推荐）：900ms
  - 更保守：1000ms - 1200ms

#### 4. maxRecordDuration（最大录制时长）
- **默认值**：300000ms（5 分钟）
- **说明**：单次说话的最大录制时长
- **调整建议**：
  - 短问答：60000ms（1 分钟）
  - 详细描述：600000ms（10 分钟）
  - 超过此时长会自动停止录制

### 注意事项

1. **前置条件**：
   - 必须先进入视频通话模式（`enterVideoCallMode()`）
   - 需要摄像头和麦克风权限

2. **浏览器兼容性**：
   - 需要支持 `MediaRecorder` API
   - 推荐使用 Chrome、Edge、Firefox 最新版
   - Safari 可能需要特定配置

3. **性能优化**：
   - 循环缓冲区只保留 5 秒，内存占用可控
   - 使用 Blob 引用而非复制，性能高效
   - 自动垃圾回收，无内存泄漏

4. **文件大小**：
   - 默认比特率 2.5 Mbps
   - 5 秒缓冲约 1.5 MB
   - 1 分钟说话约 18 MB
   - 可通过 `videoBitsPerSecond` 调整

5. **视频格式**：
   - 默认格式：WebM（VP9/VP8 + Opus）
   - 无需转换，直接可用
   - 兼容性：Chrome/Firefox 完美，Safari 可能需要转码

### 事件监听

```javascript
// 采集启动
avatar.on('videoAutoCaptureEnabled', () => {
    console.log('视频自动采集已启动');
});

// 采集停止
avatar.on('videoAutoCaptureDisabled', () => {
    console.log('视频自动采集已停止');
});

// 采集错误
avatar.on('videoAutoCaptureError', ({ error }) => {
    console.error('视频自动采集错误:', error);
});
```

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
