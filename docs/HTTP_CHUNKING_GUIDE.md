# HTTP 分块问题解决指南

## 问题描述

### 什么是 HTTP 分块问题？

当使用流式 HTTP 传输音频数据时，会遇到以下问题：

```
后端发送：
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ 完整WAV文件1 │ │ 完整WAV文件2 │ │ 完整WAV文件3 │
│    96KB     │ │    96KB     │ │    96KB     │
└─────────────┘ └─────────────┘ └─────────────┘

HTTP 实际传输（按网络情况任意分块）：
┌─────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌────────┐
│  80KB   │ │  16KB + 80KB    │ │  16KB + 80KB    │ │  16KB  │
└─────────┘ └─────────────────┘ └─────────────────┘ └────────┘
    ↓              ↓                    ↓               ↓
 不完整        跨两个文件           跨两个文件        不完整

前端接收：
❌ chunk1: 不完整的 WAV → decodeAudioData() 失败
❌ chunk2: 跨越两个文件 → 解析错误
❌ chunk3: 跨越两个文件 → 解析错误
❌ chunk4: 文件尾部 → 不完整
```

### 症状

- ✗ `decodeAudioData()` 报错：`DOMException: Unable to decode audio data`
- ✗ 部分音频片段播放失败
- ✗ 控制台错误：`AudioStreamQueue: Failed to decode audio data`
- ✗ 数字人嘴形断断续续

### 根本原因

**HTTP 传输协议不关心数据的语义**，只按网络情况切分数据包：
- TCP 分包大小：通常 1-64KB
- HTTP/2 frame：通常 16KB
- 网络拥塞控制
- 缓冲区大小

**结果**：HTTP chunk 的边界 ≠ 音频文件的边界

## 解决方案

### 使用 AudioStreamParser

我们提供了 `AudioStreamParser` 工具类，专门解决这个问题：

#### 方式 1：使用 parseAudioStream 辅助函数（推荐）

```javascript
import { DigitalHuman, parseAudioStream } from './src/index.js';

const avatar = new DigitalHuman({
    container: '#avatar'
});

// 从后端获取 WAV 流（会被 HTTP 任意分块）
async function* fetchWAVStream(text) {
    const response = await fetch('/api/tts/stream', {
        method: 'POST',
        body: JSON.stringify({ text })
    });

    const reader = response.body.getReader();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // value 是 HTTP chunk（可能不完整）
        yield value.buffer;
    }
}

// ✅ 使用解析器包装流
const rawStream = fetchWAVStream('你好，我是数字人');
const parsedStream = parseAudioStream(rawStream);

// 传递解析后的流（保证完整）
await avatar.speakStreaming({
    audioStream: parsedStream  // ✅ 每个 chunk 都是完整的 WAV 文件
});
```

#### 方式 2：手动使用 AudioStreamParser

```javascript
import { AudioStreamParser } from './src/index.js';

async function* fetchAndParseStream() {
    const parser = new AudioStreamParser({
        debug: true  // 开启调试日志
    });

    const response = await fetch('/api/tts/stream');
    const reader = response.body.getReader();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // 添加 HTTP chunk 到缓冲区
            parser.addChunk(value);

            // 提取所有完整的文件
            const completeFiles = parser.extractComplete();

            // 逐个 yield
            for (const file of completeFiles) {
                yield file;
            }
        }

        // 处理剩余数据
        const remaining = parser.finalize();
        for (const file of remaining) {
            yield file;
        }
    } finally {
        parser.clear();
    }
}

// 使用
await avatar.speakStreaming({
    audioStream: fetchAndParseStream()
});
```

## 工作原理

### AudioStreamParser 内部机制

```javascript
class AudioStreamParser {
    addChunk(chunk) {
        // 1. 缓冲所有数据
        this.buffer += chunk;
    }

    extractComplete() {
        // 2. 查找 RIFF WAV 文件边界
        while (找到 "RIFF" 标识) {
            // 3. 读取文件大小
            const size = readFileSize();

            // 4. 检查是否有完整数据
            if (buffer.length >= size) {
                // 5. 提取完整文件
                const file = buffer.slice(0, size);
                files.push(file);

                // 6. 移除已提取的数据
                buffer = buffer.slice(size);
            } else {
                // 等待更多数据
                break;
            }
        }

        return files;
    }
}
```

### RIFF WAV 文件结构

```
偏移  字节  说明
0     4     "RIFF" (0x52494646)
4     4     文件大小 - 8（小端序）
8     4     "WAVE" (0x57415645)
12    4     "fmt "
16    ...   格式信息
...   ...   数据块
```

Parser 通过识别 `RIFF` 和 `WAVE` 标识，读取文件大小，提取完整文件。

## 完整示例

### 示例 1：阿里云 TTS

```javascript
import { DigitalHuman, parseAudioStream } from './src/index.js';

async function* fetchAliyunTTS(text) {
    const response = await fetch('https://your-backend.com/aliyun-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text,
            voice: 'xiaoyun',
            format: 'wav'  // 后端返回 WAV 格式
        })
    });

    const reader = response.body.getReader();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        console.log('收到 HTTP chunk:', value.byteLength, 'bytes');
        yield value.buffer;
    }
}

// 使用
const avatar = new DigitalHuman({ container: '#avatar' });

const rawStream = fetchAliyunTTS('你好，欢迎使用数字人');
const parsedStream = parseAudioStream(rawStream, {
    debug: true  // 查看解析日志
});

await avatar.speakStreaming({
    audioStream: parsedStream,
    onChunkReceived: (chunk) => {
        console.log('解码成功:', chunk.byteLength);
    }
});
```

### 示例 2：自定义后端（累积 PCM + 添加 WAV 头）

```javascript
// 后端逻辑（Node.js）
app.post('/tts/stream', async (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');

    // 从阿里云获取 PCM 流
    for await (const pcmChunk of getAliyunPCMStream(req.body.text)) {
        // 累积 15KB PCM
        pcmBuffer += pcmChunk;

        if (pcmBuffer.length >= 15000) {
            // 添加 WAV 头，生成 96KB 完整 WAV 文件
            const wavFile = createWAV(pcmBuffer);

            // 发送（可能被 HTTP 任意分块）
            res.write(wavFile);

            pcmBuffer = '';
        }
    }

    res.end();
});

// 前端（自动处理 HTTP 分块）
const stream = parseAudioStream(fetchFromBackend());
await avatar.speakStreaming({ audioStream: stream });
```

### 示例 3：错误处理

```javascript
import { AudioStreamParser } from './src/index.js';

async function* robustAudioStream() {
    const parser = new AudioStreamParser({
        maxBufferSize: 20 * 1024 * 1024,  // 20MB 最大缓冲
        debug: true
    });

    try {
        const response = await fetch('/api/tts');
        const reader = response.body.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            try {
                parser.addChunk(value);
                const files = parser.extractComplete();

                for (const file of files) {
                    yield file;
                }
            } catch (error) {
                if (error.message.includes('Buffer overflow')) {
                    console.error('缓冲区溢出，清空并继续');
                    parser.clear();
                } else {
                    throw error;
                }
            }
        }

        // 最后提取剩余数据
        const remaining = parser.finalize();
        for (const file of remaining) {
            yield file;
        }

    } catch (error) {
        console.error('流处理错误:', error);
        throw error;
    } finally {
        parser.clear();
    }
}
```

## 配置选项

### AudioStreamParser 配置

```javascript
const parser = new AudioStreamParser({
    // 最小文件大小（字节）
    // 小于此值的不尝试解析，避免误检测
    minFileSize: 1024,  // 默认 1KB

    // 最大缓冲区大小（字节）
    // 防止内存溢出
    maxBufferSize: 10 * 1024 * 1024,  // 默认 10MB

    // 调试日志
    debug: false
});
```

## 性能优化

### 1. 合理设置缓冲区大小

```javascript
// 根据音频片段大小设置
const parser = new AudioStreamParser({
    // 如果每个 WAV 文件约 100KB
    maxBufferSize: 2 * 1024 * 1024  // 2MB 够用
});
```

### 2. 及时清理

```javascript
// 使用完毕后清理
parser.clear();
```

### 3. 监控缓冲区

```javascript
const size = parser.getBufferSize();
if (size > 1024 * 1024) {
    console.warn('缓冲区过大:', size);
}
```

## 故障排查

### 问题 1：仍然报解码错误

**检查**：是否正确使用了 parseAudioStream

```javascript
// ❌ 错误（没使用解析器）
await avatar.speakStreaming({
    audioStream: rawHTTPStream  // 直接用 HTTP chunk
});

// ✅ 正确
await avatar.speakStreaming({
    audioStream: parseAudioStream(rawHTTPStream)
});
```

### 问题 2：缓冲区溢出

**症状**：`Buffer overflow` 错误

**原因**：音频文件过大或累积过多

**解决**：
```javascript
const parser = new AudioStreamParser({
    maxBufferSize: 50 * 1024 * 1024  // 增大到 50MB
});
```

### 问题 3：没有音频输出

**检查**：开启调试日志

```javascript
const stream = parseAudioStream(rawStream, { debug: true });
```

查看日志：
```
[AudioStreamParser] Buffer size: 45678 bytes
[AudioStreamParser] Found WAV file at offset 0, size 96234 bytes
[AudioStreamParser] Extracted complete file: 96234 bytes, remaining buffer: 0
```

### 问题 4：音频断断续续

**原因**：可能是网络延迟

**解决**：增加缓冲阈值

```javascript
// 在 AudioStreamQueue 中设置
this.config.bufferThreshold = 1.0;  // 增加到 1 秒
```

## 与 PCM 转换的配合

如果后端返回 PCM，然后添加 WAV 头：

```javascript
import { parseAudioStream } from './src/index.js';

// 后端：PCM → WAV → HTTP Stream
// 前端：HTTP Stream → Parser → 完整 WAV → 自动 PCM 检测 → 播放

await avatar.speakStreaming({
    audioStream: parseAudioStream(fetchWAVStream()),

    // PCM 参数（如果需要）
    sampleRate: 16000,
    numChannels: 1,
    bitDepth: 16,

    // 可以禁用 PCM 转换（因为已经是 WAV）
    autoPCMConvert: false  // 跳过 PCM 检测
});
```

## API 参考

### parseAudioStream(stream, options)

包装异步生成器，自动解析完整音频文件。

**参数：**
- `stream`: `AsyncGenerator<ArrayBuffer>` - 原始 HTTP chunk 流
- `options`: `Object` - AudioStreamParser 配置

**返回：** `AsyncGenerator<ArrayBuffer>` - 完整音频文件流

### AudioStreamParser

手动控制的解析器类。

**方法：**
- `addChunk(chunk)` - 添加数据块
- `extractComplete()` - 提取完整文件
- `finalize()` - 处理流结束
- `clear()` - 清空缓冲区
- `getBufferSize()` - 获取缓冲区大小

## 总结

✅ **问题**：HTTP 任意分块导致音频文件不完整
✅ **解决**：使用 `AudioStreamParser` 检测并提取完整文件
✅ **优势**：无需修改后端，适用所有 WAV 流
✅ **性能**：流式处理，低内存占用
✅ **可靠**：工业标准做法，久经验证

**最佳实践**：始终使用 `parseAudioStream()` 包装后端返回的音频流！
