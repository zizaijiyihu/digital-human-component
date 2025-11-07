# 🎙️ 流式音频驱动指南

## 快速开始

流式音频功能允许你在大模型 TTS 返回音频片段时，**实时驱动数字人嘴形同步**，无需等待完整音频。

### 基础用法

```javascript
import { DigitalHuman } from './src/index.js';

const avatar = new DigitalHuman({
    container: '#avatar'
});

// 定义音频流生成器
async function* myAudioStream() {
    // 从你的 TTS API 获取音频片段
    const chunks = await fetchAudioChunksFromAPI();

    for (const chunk of chunks) {
        yield chunk; // ArrayBuffer
    }
}

// 开始流式播放
const controller = await avatar.speakStreaming({
    audioStream: myAudioStream(),
    onChunkReceived: (chunk) => {
        console.log('收到音频:', chunk.byteLength, 'bytes');
    },
    onStreamEnd: () => {
        console.log('播放完成');
    }
});
```

## 核心概念

### 1. AudioBufferSourceNode vs MediaElementAudioSourceNode

**传统模式（`speak()`）**：
- 使用 `<audio>` 元素
- 需要完整音频文件
- 不支持分块流式数据

**流式模式（`speakStreaming()`）**：
- 使用 Web Audio API 的 AudioBuffer
- 支持音频片段动态添加
- 实时处理流式数据

### 2. 工作流程

```
大模型 TTS → 音频片段 → AudioStreamQueue → AnalyserNode → LipSyncEngine → 嘴形同步
              (chunk)      (排队播放)      (FFT分析)    (音素检测)   (morph targets)
```

## 实战示例

### 示例 1：集成 OpenAI TTS

```javascript
async function speakWithOpenAI(text) {
    async function* openAIStream() {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${YOUR_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'tts-1',
                voice: 'alloy',
                input: text,
                response_format: 'mp3'
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
        audioStream: openAIStream()
    });
}
```

### 示例 2：WebSocket 实时音频

```javascript
// 建立 WebSocket 连接
const ws = new WebSocket('wss://your-tts-server.com');

// 创建流控制器
let controller = null;

ws.onopen = async () => {
    // 创建空生成器，手动推送
    controller = await avatar.speakStreaming({
        audioStream: async function* () {}
    });

    // 发送文本
    ws.send(JSON.stringify({ text: '你好世界' }));
};

// 接收音频片段
ws.onmessage = async (event) => {
    if (event.data instanceof Blob) {
        const arrayBuffer = await event.data.arrayBuffer();
        await controller.enqueueAudio(arrayBuffer);
    }
};

ws.onclose = () => {
    if (controller) {
        controller.stop();
    }
};
```

### 示例 3：本地文件模拟流式

```javascript
async function* simulateStream(audioUrl) {
    const response = await fetch(audioUrl);
    const fullAudio = await response.arrayBuffer();

    // 将完整音频切分为小片段（模拟流式返回）
    const chunkSize = 16000; // 约 100ms (16kHz)

    for (let i = 0; i < fullAudio.byteLength; i += chunkSize) {
        const end = Math.min(i + chunkSize, fullAudio.byteLength);
        const chunk = fullAudio.slice(i, end);

        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 100));

        yield chunk;
    }
}

await avatar.speakStreaming({
    audioStream: simulateStream('audio/test.wav')
});
```

## API 参考

### `avatar.speakStreaming(options)`

**参数：**

```typescript
interface StreamingOptions {
    // 必填：音频流生成器
    audioStream: AsyncGenerator<ArrayBuffer> | (() => AsyncGenerator<ArrayBuffer>);

    // 可选：采样率（默认 16000）
    sampleRate?: number;

    // 可选：收到片段时的回调
    onChunkReceived?: (chunk: ArrayBuffer) => void;

    // 可选：流结束时的回调
    onStreamEnd?: () => void;
}
```

**返回值：**

```typescript
interface StreamController {
    // 停止播放
    stop: () => void;

    // 检查是否正在播放
    isPlaying: () => boolean;

    // 手动添加音频片段
    enqueueAudio: (chunk: ArrayBuffer) => Promise<void>;
}
```

## 音频格式

### 支持的格式

- **WAV**（推荐，无需解码）
- **MP3**（常用，自动解码）
- **OGG/Opus**（高压缩比）
- **AAC/M4A**（Apple 生态）

### 推荐设置

- **采样率**：16kHz 或 24kHz
- **比特率**：64-128 kbps
- **片段大小**：100-300ms 音频数据
- **声道**：单声道（Mono）

## 性能优化

### 1. 缓冲策略

```javascript
// AudioStreamQueue 默认配置
{
    bufferThreshold: 0.5,      // 当队列 < 0.5 秒时触发 onNeedData
    maxQueueDuration: 10       // 最大缓冲 10 秒，防止内存溢出
}
```

### 2. 减少延迟

- **减小片段大小**：100ms 片段比 500ms 更低延迟
- **预加载**：提前请求下一个片段
- **使用 WebSocket**：比 HTTP 轮询更实时

### 3. 错误恢复

```javascript
const controller = await avatar.speakStreaming({
    audioStream: myStream(),
    onChunkReceived: (chunk) => {
        // 验证音频数据
        if (chunk.byteLength === 0) {
            console.warn('收到空音频片段');
        }
    }
});

// 监听错误
avatar.config.onError = (error) => {
    console.error('播放错误:', error);
    controller.stop();
    // 重试或回退到传统模式
};
```

## 常见问题

### Q1: 音频播放有杂音或卡顿？

**原因**：音频片段之间有间隙或格式不一致

**解决**：
- 确保所有片段使用相同的采样率和格式
- 增大 `bufferThreshold` 以增加缓冲
- 检查网络延迟

### Q2: 嘴形不同步？

**原因**：FFT 分析延迟或音频质量问题

**解决**：
- 使用更高采样率（≥ 16kHz）
- 确保音频清晰，减少背景噪音
- 调整 `fftSize`（在 config 中）

### Q3: 内存占用过高？

**原因**：音频队列积压

**解决**：
- 降低 `maxQueueDuration`
- 及时调用 `stop()` 清理资源
- 使用压缩格式（MP3）而非 WAV

### Q4: 浏览器兼容性？

**支持情况**：
- ✅ Chrome 89+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 89+

**不支持**：IE 11 及更早版本

## 调试技巧

### 启用调试日志

```javascript
const avatar = new DigitalHuman({
    container: '#avatar',
    debug: true  // 启用详细日志
});
```

### 监控音频队列

```javascript
const controller = await avatar.speakStreaming({
    audioStream: myStream(),
    onChunkReceived: (chunk) => {
        console.log(`[${new Date().toISOString()}] 收到 ${chunk.byteLength} bytes`);
    }
});

// 查看队列状态（内部属性，仅调试用）
console.log('队列长度:', avatar.audioStreamQueue?.queue.length);
```

### 可视化频谱分析

```javascript
// 访问内部 analyser（仅调试）
const analyser = avatar.streamAnalyser;
const dataArray = new Uint8Array(analyser.frequencyBinCount);

function visualize() {
    analyser.getByteFrequencyData(dataArray);
    console.log('频谱:', Array.from(dataArray.slice(0, 10)));
    requestAnimationFrame(visualize);
}

visualize();
```

## 最佳实践

1. **总是处理错误**：添加 `onError` 回调
2. **清理资源**：不再使用时调用 `destroy()`
3. **测试网络条件**：在慢网络下测试缓冲策略
4. **监控性能**：使用 Chrome DevTools 的 Performance 面板
5. **渐进增强**：提供传统模式作为后备方案

```javascript
async function speak(audio) {
    // 尝试流式模式
    if (isStreamingSupported()) {
        try {
            await avatar.speakStreaming({ audioStream: audio });
        } catch (error) {
            console.warn('流式模式失败，回退到传统模式');
            await avatar.speak(audio);
        }
    } else {
        // 回退到传统模式
        await avatar.speak(audio);
    }
}

function isStreamingSupported() {
    return 'AudioContext' in window &&
           'createBufferSource' in AudioContext.prototype;
}
```

## 进一步阅读

- [Web Audio API 文档](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AudioBuffer 详解](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer)
- [Async Generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function*)
- [完整示例](./examples/streaming-audio.html)

---

**有问题？** 请在 [GitHub Issues](https://github.com/zizaijiyihu/digital-human-component/issues) 提出。
