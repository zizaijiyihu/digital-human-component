/**
 * 循环视频缓冲区
 * 维护最近 N 秒的视频片段
 * 策略：始终保留第一个 chunk（包含 WebM 头部），然后循环存储最近的数据
 */
export class CircularVideoBuffer {
    constructor(duration = 5000) {
        this.maxDuration = duration; // 最大缓冲时长（毫秒）
        this.chunks = [];            // 视频数据块
        this.timestamps = [];        // 对应的时间戳
        this.startTime = null;       // 缓冲区开始时间
        this.firstChunk = null;      // 第一个 chunk（包含 WebM 头部，永不删除）
        this.firstTimestamp = null;  // 第一个 chunk 的时间戳
    }

    /**
     * 添加视频片段
     * @param {Blob} chunk - 视频数据块
     * @param {number} timestamp - 时间戳（毫秒）
     */
    add(chunk, timestamp) {
        if (this.startTime === null) {
            this.startTime = timestamp;
        }

        // 保存第一个 chunk（包含 WebM 头部，必须保留）
        if (this.firstChunk === null) {
            this.firstChunk = chunk;
            this.firstTimestamp = timestamp;
            console.log(`[CircularBuffer] Saved first chunk (${chunk.size} bytes) - contains WebM header`);
        }

        this.chunks.push(chunk);
        this.timestamps.push(timestamp);

        // 移除超过最大时长的旧片段（但不删除第一个 chunk）
        this._pruneOldChunks(timestamp);
    }

    /**
     * 清理超过最大时长的旧片段
     * 保证第一个 chunk 永不被删除
     * @private
     * @param {number} currentTime - 当前时间戳
     */
    _pruneOldChunks(currentTime) {
        const cutoffTime = currentTime - this.maxDuration;
        let removedCount = 0;

        // 从第二个 chunk 开始检查（索引1），第一个 chunk（索引0）永远保留
        // 删除所有时间戳早于 cutoffTime 的 chunks，但保留第一个
        while (this.chunks.length > 1 && this.timestamps[0] !== this.firstTimestamp && this.timestamps[0] < cutoffTime) {
            this.chunks.shift();
            this.timestamps.shift();
            removedCount++;
        }

        if (removedCount > 0) {
            console.log(`[CircularBuffer] Pruned ${removedCount} old chunks, keeping ${this.chunks.length} chunks (duration: ${this.getDuration()}ms)`);
        }

        // 更新开始时间
        if (this.timestamps.length > 0) {
            this.startTime = this.timestamps[0];
        }
    }

    /**
     * 获取所有缓冲的视频片段
     * @returns {Blob[]} 视频数据块数组
     */
    getAll() {
        console.log(`[CircularBuffer] Returning ${this.chunks.length} chunks, duration: ${this.getDuration()}ms`);
        return [...this.chunks];
    }

    /**
     * 获取缓冲区的时长（毫秒）
     * 基于实际保留的数据片段计算
     * @returns {number}
     */
    getDuration() {
        if (this.timestamps.length === 0) {
            return 0;
        }

        if (this.timestamps.length === 1) {
            return 0; // 只有第一个chunk，时长为0
        }

        // 如果第一个chunk还在，从第二个chunk开始计算实际数据时长
        const startIdx = (this.timestamps[0] === this.firstTimestamp) ? 1 : 0;

        if (startIdx >= this.timestamps.length) {
            return 0;
        }

        // 计算实际媒体数据的时长（排除第一个初始化chunk）
        const duration = this.timestamps[this.timestamps.length - 1] - this.timestamps[startIdx];

        // 时长不应超过最大缓冲时长
        return Math.min(duration, this.maxDuration);
    }

    /**
     * 获取缓冲区的片段数量
     * @returns {number}
     */
    getChunkCount() {
        return this.chunks.length;
    }

    /**
     * 清空缓冲区
     */
    clear() {
        this.chunks = [];
        this.timestamps = [];
        this.startTime = null;
        this.firstChunk = null;
        this.firstTimestamp = null;
    }

    /**
     * 获取缓冲区总大小（字节）
     * @returns {number}
     */
    getTotalSize() {
        return this.chunks.reduce((total, chunk) => total + chunk.size, 0);
    }

    /**
     * 检查缓冲区是否为空
     * @returns {boolean}
     */
    isEmpty() {
        return this.chunks.length === 0;
    }
}
