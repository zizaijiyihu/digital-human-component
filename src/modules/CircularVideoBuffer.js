/**
 * 循环视频缓冲区（分组录制架构）
 * 维护最近 N 组视频，每组 M 秒
 *
 * 架构设计：
 * - MediaRecorder 每 M 秒重启一次，生成一个独立的视频组
 * - 每个视频组包含：完整的 initialization segment + media segments
 * - 循环保留最近 N 组视频（默认 3 组）
 * - 说话时：返回说话前的 N 组 + 说话期间的 1 组（共 N+1 组视频）
 */
export class CircularVideoBuffer {
    constructor(maxGroups = 1) {
        this.maxGroups = maxGroups;  // 最多保留的视频组数量（默认 1 组）
        this.videoGroups = [];       // 视频组数组：[{ blob, startTime, endTime, duration }, ...]
        this.currentChunks = [];     // 当前组正在录制的 chunks
        this.currentStartTime = null;
    }

    /**
     * 开始新的视频组（MediaRecorder 重启时调用）
     * @param {number} timestamp - 开始时间戳
     */
    startNewGroup(timestamp) {
        // 如果有当前正在录制的组，先完成它
        if (this.currentChunks.length > 0) {
            this._finishCurrentGroup(timestamp);
        }

        // 开始新组
        this.currentChunks = [];
        this.currentStartTime = timestamp;
        console.log(`[CircularBuffer] Started new group #${this.videoGroups.length + 1} at ${timestamp}`);
    }

    /**
     * 添加视频片段到当前组
     * @param {Blob} chunk - 视频数据块
     */
    add(chunk) {
        if (!this.currentStartTime) {
            console.warn('[CircularBuffer] No current group, call startNewGroup first');
            return;
        }

        this.currentChunks.push(chunk);
    }

    /**
     * 完成当前组的录制
     * @private
     * @param {number} endTime - 结束时间戳
     */
    _finishCurrentGroup(endTime) {
        if (this.currentChunks.length === 0) {
            return;
        }

        const duration = endTime - this.currentStartTime;
        const blob = new Blob(this.currentChunks, { type: 'video/webm' });

        const videoGroup = {
            blob: blob,
            startTime: this.currentStartTime,
            endTime: endTime,
            duration: duration,
            size: blob.size,
            chunkCount: this.currentChunks.length
        };

        this.videoGroups.push(videoGroup);
        console.log(`[CircularBuffer] Group #${this.videoGroups.length} completed: ${(duration / 1000).toFixed(1)}s, ${(blob.size / 1024 / 1024).toFixed(2)} MB, ${this.currentChunks.length} chunks`);

        // 清理旧组（只保留最近 N 组）
        if (this.videoGroups.length > this.maxGroups) {
            const removed = this.videoGroups.shift();
            console.log(`[CircularBuffer] Removed old group: ${(removed.duration / 1000).toFixed(1)}s, ${(removed.size / 1024 / 1024).toFixed(2)} MB`);
        }

        // 重置当前组
        this.currentChunks = [];
        this.currentStartTime = null;
    }

    /**
     * 获取所有已完成的视频组（不包括当前正在录制的组）
     * @returns {Array} 视频组数组
     */
    getAllGroups() {
        return [...this.videoGroups];
    }

    /**
     * 获取当前正在录制的组（包括未完成的）
     * @returns {Object|null} 当前组的 blob 和元数据
     */
    getCurrentGroup() {
        if (this.currentChunks.length === 0) {
            return null;
        }

        const blob = new Blob(this.currentChunks, { type: 'video/webm' });
        const duration = Date.now() - this.currentStartTime;

        return {
            blob: blob,
            startTime: this.currentStartTime,
            endTime: Date.now(),
            duration: duration,
            size: blob.size,
            chunkCount: this.currentChunks.length,
            isRecording: true  // 标记为正在录制中
        };
    }

    /**
     * 获取视频组数量
     * @returns {number}
     */
    getGroupCount() {
        return this.videoGroups.length;
    }

    /**
     * 检查是否为空
     * @returns {boolean}
     */
    isEmpty() {
        return this.videoGroups.length === 0 && this.currentChunks.length === 0;
    }

    /**
     * 清空所有数据
     */
    clear() {
        this.videoGroups = [];
        this.currentChunks = [];
        this.currentStartTime = null;
        console.log('[CircularBuffer] Cleared all groups');
    }
}
