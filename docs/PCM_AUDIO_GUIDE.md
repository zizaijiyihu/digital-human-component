# PCM 音频处理指南

## 什么是 PCM？

PCM（Pulse Code Modulation，脉冲编码调制）是一种未压缩的原始音频格式，通常由 TTS 服务直接生成。它只包含音频采样数据，**没有文件头信息**。

## 为什么需要转换？

浏览器的 Web Audio API 需要完整的音频文件格式（如 WAV），无法直接解码 PCM 数据。因此需要：

1. **添加 WAV 文件头**：包含采样率、声道数、位深度等信息
2. **封装为 WAV 格式**：使浏览器能够正确解码

## 自动 PCM 转换（推荐）

数字人组件已内置 **自动 PCM 检测和转换**功能，开箱即用！

### 使用流式音频 API

```javascript
import { DigitalHuman } from './src/index.js';

const avatar = new DigitalHuman({
    container: '#avatar'
});

// 从后端 TTS 接收 PCM 流
async function* fetchPCMStream(text) {
    const response = await fetch('/api/tts/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });

    const reader = response.body.getReader();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // value 是 PCM 原始数据（Uint8Array）
        yield value.buffer; // 自动转换为 WAV！
    }
}

// 使用（自动处理 PCM）
await avatar.speakStreaming({
    audioStream: fetchPCMStream('你好，我是数字人'),

    // 可选：指定 PCM 参数（如果与默认值不同）
    sampleRate: 16000,    // 采样率（默认 16000）
    numChannels: 1,       // 声道数（默认 1）
    bitDepth: 16,         // 位深度（默认 16）

    // 可选：禁用自动转换（如果你的数据已经是 WAV）
    // autoPCMConvert: false
});
```

### 配置说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `autoPCMConvert` | boolean | `true` | 是否自动检测并转换 PCM |
| `sampleRate` | number | `16000` | PCM 采样率（Hz） |
| `numChannels` | number | `1` | PCM 声道数（1=单声道, 2=立体声） |
| `bitDepth` | number | `16` | PCM 位深度（8/16/24/32） |

## 手动 PCM 转换

如果需要手动控制转换过程，可以使用工具函数：

### 方式 1：使用 `processAudioData`（自动检测）

```javascript
import { processAudioData } from './src/index.js';

// 自动检测格式并处理
const pcmData = await fetch('/api/tts/chunk').then(r => r.arrayBuffer());
const wavData = processAudioData(pcmData, {
    sampleRate: 16000,
    numChannels: 1,
    bitDepth: 16
});

// 直接使用 WAV 数据
await avatar.speak(new Blob([wavData], { type: 'audio/wav' }));
```

### 方式 2：使用 `pcmToWav`（强制转换）

```javascript
import { pcmToWav } from './src/index.js';

// 已知是 PCM，直接转换
const pcmData = new Uint8Array([...]); // PCM 原始数据
const wavData = pcmToWav(pcmData, {
    sampleRate: 24000,  // 24kHz
    numChannels: 1,
    bitDepth: 16
});
```

### 方式 3：使用 `PCMToWavConverter`（批量处理）

```javascript
import { PCMToWavConverter } from './src/index.js';

// 创建转换器
const converter = new PCMToWavConverter({
    sampleRate: 16000,
    numChannels: 1,
    bitDepth: 16
});

// 转换单个片段
const wavChunk = converter.convert(pcmChunk);

// 批量转换
const pcmChunks = [chunk1, chunk2, chunk3];
const wavChunks = converter.convertBatch(pcmChunks);
```

## 常见 TTS 服务的 PCM 参数

### OpenAI TTS

```javascript
// OpenAI TTS 返回 PCM 格式
await avatar.speakStreaming({
    audioStream: fetchOpenAITTS('你好'),
    sampleRate: 24000,  // OpenAI 默认 24kHz
    numChannels: 1,
    bitDepth: 16
});
```

### Azure TTS

```javascript
// Azure TTS 可配置为 PCM
await avatar.speakStreaming({
    audioStream: fetchAzureTTS('你好'),
    sampleRate: 16000,  // Azure 支持多种采样率
    numChannels: 1,
    bitDepth: 16
});
```

### Google Cloud TTS

```javascript
// Google TTS 返回 LINEAR16 (PCM)
await avatar.speakStreaming({
    audioStream: fetchGoogleTTS('你好'),
    sampleRate: 16000,  // 或 24000
    numChannels: 1,
    bitDepth: 16
});
```

### 自定义后端

```javascript
// 后端返回纯 PCM 流
async function* fetchCustomTTS(text) {
    const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text,
            format: 'pcm',          // 请求 PCM 格式
            sampleRate: 16000,
            channels: 1
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
    audioStream: fetchCustomTTS('你好，世界'),
    sampleRate: 16000,
    numChannels: 1,
    bitDepth: 16
});
```

## 检测音频格式

使用 `isPCM()` 函数检测音频数据格式：

```javascript
import { isPCM } from './src/index.js';

const audioData = await fetch('/audio/sample').then(r => r.arrayBuffer());

if (isPCM(audioData)) {
    console.log('这是 PCM 格式');
} else {
    console.log('这是其他格式（可能是 WAV/MP3/OGG）');
}
```

## 性能优化

### 1. 减少转换开销

如果后端支持，**直接返回 WAV 格式**可以避免客户端转换：

```javascript
// 后端配置
{
    format: 'wav',  // 而不是 'pcm'
    sampleRate: 16000
}
```

### 2. 禁用自动转换

如果确定数据已经是 WAV：

```javascript
await avatar.speakStreaming({
    audioStream: fetchWAVStream(),
    autoPCMConvert: false  // 跳过检测和转换
});
```

### 3. 使用合适的采样率

| 采样率 | 适用场景 | 音质 | 数据量 |
|--------|---------|------|--------|
| 8000 Hz | 电话质量 | 低 | 最小 |
| 16000 Hz | 语音识别/TTS | 中 | 中等 |
| 24000 Hz | 高质量语音 | 高 | 较大 |
| 44100 Hz | CD 音质 | 极高 | 最大 |

**推荐**：语音应用使用 **16kHz 或 24kHz**。

## 故障排查

### 问题 1：音频无法播放

**症状**：控制台报错 `Failed to decode audio data`

**原因**：PCM 参数不匹配

**解决**：
```javascript
// 检查后端返回的实际参数
await avatar.speakStreaming({
    audioStream: pcmStream,
    sampleRate: 24000,  // ← 确保与后端一致
    numChannels: 1,
    bitDepth: 16
});
```

### 问题 2：声音失真或速度异常

**症状**：播放速度过快或过慢，声音变调

**原因**：采样率设置错误

**解决**：
```javascript
// 如果声音太快 → 采样率设置偏低，应该提高
// 如果声音太慢 → 采样率设置偏高，应该降低

// 后端实际 24kHz，但设置为 16kHz → 声音加速
// 正确设置：
sampleRate: 24000  // 与后端一致
```

### 问题 3：只有噪音

**症状**：播放出的全是噪音

**原因**：
1. PCM 数据损坏
2. 位深度设置错误（8/16 位混淆）

**解决**：
```javascript
// 检查位深度
bitDepth: 16  // 大部分 TTS 使用 16 位
```

## 完整示例

```javascript
import { DigitalHuman } from './src/index.js';

// 创建数字人
const avatar = new DigitalHuman({
    container: '#avatar'
});

// 从后端 TTS 获取 PCM 流
async function* streamTTSFromBackend(text) {
    const response = await fetch('https://api.example.com/tts/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text,
            voice: 'zh-CN-XiaoxiaoNeural',
            format: 'pcm',
            sampleRate: 16000,
            channels: 1
        })
    });

    if (!response.ok) {
        throw new Error('TTS request failed');
    }

    const reader = response.body.getReader();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // value 是 PCM 数据（Uint8Array）
        console.log('收到 PCM 片段:', value.byteLength, 'bytes');
        yield value.buffer;
    }
}

// 使用（自动 PCM 转换）
async function speak(text) {
    try {
        await avatar.speakStreaming({
            audioStream: streamTTSFromBackend(text),

            // PCM 参数（与后端一致）
            sampleRate: 16000,
            numChannels: 1,
            bitDepth: 16,

            // 回调
            onChunkReceived: (chunk) => {
                console.log('已处理音频片段:', chunk.byteLength);
            },

            onStreamEnd: () => {
                console.log('播放完成');
                avatar.startListening();
            }
        });
    } catch (error) {
        console.error('播放失败:', error);
    }
}

// 开始播放
speak('你好，我是数字人助手，很高兴为你服务！');
```

## API 参考

### `pcmToWav(pcmData, options)`

将 PCM 数据转换为 WAV 格式。

**参数：**
- `pcmData`: `ArrayBuffer | Uint8Array` - PCM 原始数据
- `options.sampleRate`: `number` - 采样率（默认 16000）
- `options.numChannels`: `number` - 声道数（默认 1）
- `options.bitDepth`: `number` - 位深度（默认 16）

**返回：** `ArrayBuffer` - WAV 格式音频

### `isPCM(audioData)`

检测音频数据是否为 PCM 格式。

**参数：**
- `audioData`: `ArrayBuffer` - 音频数据

**返回：** `boolean`

### `processAudioData(audioData, options)`

自动处理音频数据：如果是 PCM 则转换为 WAV。

**参数：**
- `audioData`: `ArrayBuffer` - 音频数据
- `options`: 同 `pcmToWav`

**返回：** `ArrayBuffer`

## 总结

✅ **自动化处理**：组件已内置 PCM 自动检测和转换
✅ **无需额外代码**：直接使用 `speakStreaming()` 即可
✅ **性能优化**：支持流式转换，无需等待完整数据
✅ **灵活配置**：支持各种采样率和位深度
✅ **兼容性好**：支持所有主流 TTS 服务

**最佳实践**：让组件自动处理，只需在 `speakStreaming()` 中指定正确的 PCM 参数即可！
