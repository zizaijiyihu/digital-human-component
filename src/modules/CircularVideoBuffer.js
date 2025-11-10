/**
 * 循环视频缓冲区
 * 维护最近 N 秒的视频片段
 */
export class CircularVideoBuffer {
    constructor(duration = 5000) {
        this.maxDuration = duration; // 最大缓冲时长（毫秒）
        this.chunks = [];            // 视频数据块
        this.timestamps = [];        // 对应的时间戳
        this.startTime = null;       // 缓冲区开始时间
        this.initChunk = null;       // 初始化片段（WebM 头部，必须保留）
        this.initTimestamp = null;   // 初始化片段的时间戳
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

        // 第一个 chunk 是初始化片段，包含 WebM 文件头和元数据
        if (this.initChunk === null) {
            this.initChunk = chunk;
            this.initTimestamp = timestamp;
            console.log(`[CircularBuffer] Saved init chunk (${chunk.size} bytes) - contains video metadata`);
        }

        this.chunks.push(chunk);
        this.timestamps.push(timestamp);

        // 移除超过最大时长的旧片段（但保留初始化片段）
        this._pruneOldChunks(timestamp);
    }

    /**
     * 清理超过最大时长的旧片段
     * @private
     * @param {number} currentTime - 当前时间戳
     */
    _pruneOldChunks(currentTime) {
        const cutoffTime = currentTime - this.maxDuration;

        // 正常清理超时的 chunks
        while (this.timestamps.length > 0 && this.timestamps[0] < cutoffTime) {
            this.chunks.shift();
            this.timestamps.shift();
        }

        // 更新开始时间
        if (this.timestamps.length > 0) {
            this.startTime = this.timestamps[0];
        }
    }

    /**
     * 获取所有缓冲的视频片段
     * 确保初始化片段总是在最前面
     * @returns {Blob[]} 视频数据块数组
     */
    getAll() {
        // 如果初始化片段存在且不在 chunks 数组中，将其添加到开头
        if (this.initChunk && (this.chunks.length === 0 || this.chunks[0] !== this.initChunk)) {
            console.log(`[CircularBuffer] Prepending init chunk to ensure valid video`);
            return [this.initChunk, ...this.chunks];
        }
        return [...this.chunks];
    }

    /**
     * 获取缓冲区的时长（毫秒）
     * @returns {number}
     */
    getDuration() {
        if (this.timestamps.length === 0) {
            return 0;
        }

        return this.timestamps[this.timestamps.length - 1] - this.timestamps[0];
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
        this.initChunk = null;
        this.initTimestamp = null;
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
