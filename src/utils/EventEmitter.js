/**
 * 简单的事件发射器
 */
export class EventEmitter {
    constructor() {
        this._events = {};
    }

    /**
     * 监听事件
     */
    on(event, callback) {
        if (!this._events[event]) {
            this._events[event] = [];
        }
        this._events[event].push(callback);
        return this;
    }

    /**
     * 监听一次
     */
    once(event, callback) {
        const wrapper = (...args) => {
            callback(...args);
            this.off(event, wrapper);
        };
        return this.on(event, wrapper);
    }

    /**
     * 移除监听
     */
    off(event, callback) {
        if (!this._events[event]) {
            return this;
        }

        if (!callback) {
            delete this._events[event];
            return this;
        }

        this._events[event] = this._events[event].filter(cb => cb !== callback);
        return this;
    }

    /**
     * 触发事件
     */
    emit(event, ...args) {
        if (!this._events[event]) {
            return this;
        }

        this._events[event].forEach(callback => {
            callback(...args);
        });
        return this;
    }

    /**
     * 移除所有监听
     */
    removeAllListeners(event) {
        if (event) {
            delete this._events[event];
        } else {
            this._events = {};
        }
        return this;
    }
}
