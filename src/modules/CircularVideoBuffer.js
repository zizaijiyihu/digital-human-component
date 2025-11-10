/**
 * 循环视频缓冲区
 * 维护最近 N 秒的视频片段
 */
export class CircularVideoBuffer {
    constructor(duration = 5000) {
        this.maxDuration = duration; // 最大缓冲时长（毫秒）
        this.chunks = [];            // 视频数据块（不包含初始化片段）
        this.timestamps = [];        // 对应的时间戳
        this.startTime = null;       // 缓冲区开始时间
        this.initChunk = null;       // 初始化片段（WebM 头部，单独保存）
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

        // 第一个有意义的 chunk 是初始化片段（通常 > 1KB）
        // MediaRecorder 可能在启动时产生一个非常小的空 chunk，需要跳过
        if (this.initChunk === null && chunk.size > 1024) {
            this.initChunk = chunk;
            this.initTimestamp = timestamp;
            console.log(`[CircularBuffer] Saved init chunk (${chunk.size} bytes) - this is the header, will not be in circular buffer`);
            // 初始化片段不加入循环缓冲区
            return;
        }

        // 跳过初始化片段之前的小 chunk
        if (this.initChunk === null) {
            console.log(`[CircularBuffer] Skipping small chunk (${chunk.size} bytes) waiting for init segment`);
            return;
        }

        this.chunks.push(chunk);
        this.timestamps.push(timestamp);

        // 移除超过最大时长的旧片段
        this._pruneOldChunks(timestamp);
    }

    /**
     * 清理超过最大时长的旧片段
     * @private
     * @param {number} currentTime - 当前时间戳
     */
    _pruneOldChunks(currentTime) {
        const cutoffTime = currentTime - this.maxDuration;
        let removedCount = 0;

        // 正常清理超时的 chunks
        while (this.timestamps.length > 0 && this.timestamps[0] < cutoffTime) {
            this.chunks.shift();
            this.timestamps.shift();
            removedCount++;
        }

        if (removedCount > 0) {
            console.log(`[CircularBuffer] Pruned ${removedCount} old chunks, keeping ${this.chunks.length} chunks (${this.getDuration()}ms)`);
        }

        // 更新开始时间
        if (this.timestamps.length > 0) {
            this.startTime = this.timestamps[0];
        }
    }

    /**
     * 获取所有缓冲的视频片段
     * 始终将初始化片段放在最前面
     * @returns {Blob[]} 视频数据块数组
     */
    getAll() {
        // 初始化片段 + 循环缓冲区的数据片段
        if (this.initChunk) {
            console.log(`[CircularBuffer] Returning ${this.chunks.length + 1} chunks (1 init + ${this.chunks.length} media segments)`);
            return [this.initChunk, ...this.chunks];
        }
        console.warn(`[CircularBuffer] No init chunk found, returning ${this.chunks.length} chunks (may not be playable)`);
        return [...this.chunks];
    }

    /**
     * 获取缓冲区的时长（毫秒）
     * 基于实际的媒体片段时间戳计算
     * @returns {number}
     */
    getDuration() {
        if (this.timestamps.length === 0) {
            return 0;
        }

        // 计算最后一个片段和第一个片段的时间差
        const duration = this.timestamps[this.timestamps.length - 1] - this.timestamps[0];

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
