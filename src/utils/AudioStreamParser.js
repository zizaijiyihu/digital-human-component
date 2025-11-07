/**
 * 音频流解析器
 *
 * 解决 HTTP 流式传输中的分块问题：
 * - HTTP 会在任意位置切分数据流
 * - 导致前端收到不完整的音频文件（如 WAV）
 * - decodeAudioData() 解码失败
 *
 * 工作原理：
 * 1. 缓冲所有接收到的数据
 * 2. 检测完整的音频文件边界（RIFF WAV）
 * 3. 提取完整的音频文件
 * 4. 只传递完整文件给解码器
 */
export class AudioStreamParser {
    constructor(options = {}) {
        // 数据缓冲区
        this.buffer = new Uint8Array(0);

        // 配置
        this.config = {
            // 最小文件大小（字节），小于此值不尝试解析
            minFileSize: options.minFileSize || 1024,

            // 最大缓冲区大小（字节），防止内存溢出
            maxBufferSize: options.maxBufferSize || 10 * 1024 * 1024, // 10MB

            // 是否启用调试日志
            debug: options.debug || false
        };
    }

    /**
     * 添加数据块到缓冲区
     * @param {ArrayBuffer|Uint8Array} chunk - 数据块
     */
    addChunk(chunk) {
        const chunkBytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);

        // 检查缓冲区大小
        if (this.buffer.length + chunkBytes.length > this.config.maxBufferSize) {
            throw new Error(`AudioStreamParser: Buffer overflow (max ${this.config.maxBufferSize} bytes)`);
        }

        // 合并到缓冲区
        const newBuffer = new Uint8Array(this.buffer.length + chunkBytes.length);
        newBuffer.set(this.buffer, 0);
        newBuffer.set(chunkBytes, this.buffer.length);
        this.buffer = newBuffer;

        if (this.config.debug) {
            console.log(`[AudioStreamParser] Buffer size: ${this.buffer.length} bytes`);
        }
    }

    /**
     * 从缓冲区提取所有完整的音频文件
     * @returns {Array<ArrayBuffer>} 完整的音频文件数组
     */
    extractComplete() {
        const completeFiles = [];

        while (this.buffer.length >= this.config.minFileSize) {
            // 查找 RIFF WAV 文件
            const fileInfo = this._findNextWavFile();

            if (!fileInfo) {
                // 没有找到完整文件，等待更多数据
                break;
            }

            const { start, size } = fileInfo;

            // 检查是否有完整的文件数据
            if (start + size > this.buffer.length) {
                // 文件不完整，等待更多数据
                if (this.config.debug) {
                    console.log(`[AudioStreamParser] Incomplete file: need ${start + size} bytes, have ${this.buffer.length}`);
                }
                break;
            }

            // 提取完整文件
            const fileData = this.buffer.slice(start, start + size);
            completeFiles.push(fileData.buffer);

            // 从缓冲区移除已提取的文件
            this.buffer = this.buffer.slice(start + size);

            if (this.config.debug) {
                console.log(`[AudioStreamParser] Extracted complete file: ${size} bytes, remaining buffer: ${this.buffer.length}`);
            }
        }

        return completeFiles;
    }

    /**
     * 查找缓冲区中下一个完整的 WAV 文件
     * @private
     * @returns {{start: number, size: number}|null}
     */
    _findNextWavFile() {
        // 查找 "RIFF" 标识
        for (let i = 0; i <= this.buffer.length - 8; i++) {
            // 检查是否是 RIFF
            if (this.buffer[i] === 0x52 &&      // 'R'
                this.buffer[i + 1] === 0x49 &&  // 'I'
                this.buffer[i + 2] === 0x46 &&  // 'F'
                this.buffer[i + 3] === 0x46) {  // 'F'

                // 读取文件大小（小端序）
                const fileSize = this._readUint32LE(this.buffer, i + 4);

                // WAV 文件总大小 = 8 字节（RIFF + size） + fileSize
                const totalSize = 8 + fileSize;

                // 验证 WAVE 标识
                if (i + 12 <= this.buffer.length &&
                    this.buffer[i + 8] === 0x57 &&   // 'W'
                    this.buffer[i + 9] === 0x41 &&   // 'A'
                    this.buffer[i + 10] === 0x56 &&  // 'V'
                    this.buffer[i + 11] === 0x45) {  // 'E'

                    if (this.config.debug) {
                        console.log(`[AudioStreamParser] Found WAV file at offset ${i}, size ${totalSize} bytes`);
                    }

                    return {
                        start: i,
                        size: totalSize
                    };
                }
            }
        }

        return null;
    }

    /**
     * 读取小端序 32 位整数
     * @private
     */
    _readUint32LE(buffer, offset) {
        return buffer[offset] |
               (buffer[offset + 1] << 8) |
               (buffer[offset + 2] << 16) |
               (buffer[offset + 3] << 24);
    }

    /**
     * 清空缓冲区
     */
    clear() {
        this.buffer = new Uint8Array(0);
    }

    /**
     * 获取当前缓冲区大小
     */
    getBufferSize() {
        return this.buffer.length;
    }

    /**
     * 处理流结束：返回缓冲区中剩余的数据
     * @returns {Array<ArrayBuffer>}
     */
    finalize() {
        const files = this.extractComplete();

        // 如果还有剩余数据，警告
        if (this.buffer.length > 0) {
            console.warn(`[AudioStreamParser] ${this.buffer.length} bytes remaining in buffer (incomplete file)`);
        }

        return files;
    }
}

/**
 * 辅助函数：包装异步生成器，自动解析完整的音频文件
 *
 * @param {AsyncGenerator<ArrayBuffer>} stream - 原始 HTTP chunk 流
 * @param {Object} options - 解析器配置
 * @returns {AsyncGenerator<ArrayBuffer>} 完整音频文件流
 *
 * @example
 * // 原始用法（有问题）
 * for await (const chunk of httpStream) {
 *     await queue.enqueue(chunk); // ❌ 可能不完整
 * }
 *
 * // 使用解析器（正确）
 * const parsedStream = parseAudioStream(httpStream);
 * for await (const completeFile of parsedStream) {
 *     await queue.enqueue(completeFile); // ✅ 保证完整
 * }
 */
export async function* parseAudioStream(stream, options = {}) {
    const parser = new AudioStreamParser(options);

    try {
        for await (const chunk of stream) {
            // 添加到缓冲区
            parser.addChunk(chunk);

            // 提取所有完整文件
            const completeFiles = parser.extractComplete();

            // 逐个 yield 完整文件
            for (const file of completeFiles) {
                yield file;
            }
        }

        // 流结束，处理剩余数据
        const remaining = parser.finalize();
        for (const file of remaining) {
            yield file;
        }

    } finally {
        // 清理
        parser.clear();
    }
}
