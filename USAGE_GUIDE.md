# Digital Human 使用指南

## 🤔 我应该使用哪种方式？

### 情况 1：我只想快速测试/使用
**推荐：方法 A - 本地服务器 + ES Module**

```bash
# 1. 下载或克隆项目
git clone https://github.com/zizaijiyihu/digital-human-component.git
cd digital-human-component

# 2. 启动本地服务器
python3 -m http.server 8000

# 3. 在浏览器中打开
http://localhost:8000/examples/standalone.html
```

**优点**：
- ✅ 无需安装任何依赖
- ✅ 无需构建工具
- ✅ 开箱即用

**缺点**：
- ❌ 不能直接双击 HTML 文件打开（必须通过服务器）

---

### 情况 2：我在开发一个 Web 项目（使用 React/Vue/Angular）
**推荐：方法 B - NPM 安装 + 构建工具**

```bash
# 1. 安装依赖
npm install three@0.160.0

# 2. 复制组件文件到项目
# 将 src/ 文件夹复制到你的项目中

# 3. 在代码中导入
import { DigitalHuman } from './src/index.js';

// 4. 使用
const avatar = new DigitalHuman({
    container: '#avatar',
    modelUrl: 'https://models.readyplayer.me/xxx.glb',
    autoStart: 'listening'
});
```

**优点**：
- ✅ 与现有项目集成
- ✅ 可以使用 npm 管理依赖
- ✅ 构建工具自动处理模块

**缺点**：
- ❌ 需要学习构建工具（Webpack/Vite）
- ❌ 项目结构较复杂

---

### 情况 3：我想在服务器上部署给别人使用
**推荐：方法 C - CDN 方式**

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body>
    <div id="avatar"></div>

    <script type="importmap">
    {
        "imports": {
            "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
            "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
        }
    }
    </script>

    <script type="module">
        import { DigitalHuman } from 'https://cdn.jsdelivr.net/gh/zizaijiyihu/digital-human-component@latest/src/index.js';

        const avatar = new DigitalHuman({
            container: '#avatar',
            modelUrl: 'https://models.readyplayer.me/xxx.glb',
            autoStart: 'listening'
        });
    </script>
</body>
</html>
```

**优点**：
- ✅ 无需下载文件
- ✅ CDN 加速
- ✅ 自动更新

**缺点**：
- ❌ 依赖网络连接
- ❌ 可能受 CDN 限制

---

## 🔍 详细对比

| 方式 | 能否直接双击打开 | 需要构建工具 | 需要本地服务器 | 适用场景 |
|------|-----------------|-------------|---------------|---------|
| **ES Module (源码)** | ❌ | ❌ | ✅ | 快速测试、本地开发 |
| **UMD 构建版** | ❌ | ✅ | 可选 | 大型项目、打包工具 |
| **CDN** | ❌ | ❌ | ✅ | 在线部署、分享 |

---

## ❓ 常见问题

### Q1: 为什么不能直接双击 HTML 文件打开？

**A:** 因为浏览器的安全限制，`file://` 协议不允许加载 ES6 模块。

**错误示例：**
```
❌ file:///Users/xxx/project/index.html
浏览器报错：CORS policy blocked
```

**正确做法：**
```
✅ http://localhost:8000/index.html
通过本地服务器访问
```

### Q2: 什么是 ES Module？

**A:** ES Module 是 JavaScript 的标准模块系统，使用 `import` 和 `export` 语法。

```javascript
// ES Module（现代方式）
import { DigitalHuman } from './index.js';

// 传统方式（旧）
<script src="lib1.js"></script>
<script src="lib2.js"></script>
```

### Q3: 什么是 UMD？

**A:** UMD (Universal Module Definition) 是一种兼容多种模块系统的格式。

```javascript
// 可以在不同环境使用：
// 1. 浏览器全局变量
<script src="digital-human.min.js"></script>
<script>
    const avatar = new DigitalHuman.DigitalHuman(...);
</script>

// 2. Node.js
const { DigitalHuman } = require('digital-human');

// 3. ES Module
import { DigitalHuman } from 'digital-human';
```

### Q4: 我该选择哪个？

**根据你的情况：**

| 如果你是... | 推荐使用 |
|-----------|---------|
| 前端新手，想快速体验 | **ES Module + 本地服务器** |
| 有前端项目经验 | **ES Module + 构建工具** |
| 资深开发者 | **UMD + 打包工具** |
| 只想做一个简单演示 | **CDN + ES Module** |

---

## 📝 启动本地服务器的方法

### 方法 1：Python（最简单，Mac/Linux 自带）
```bash
python3 -m http.server 8000
```

### 方法 2：Node.js
```bash
npx http-server -p 8000
```

### 方法 3：PHP
```bash
php -S localhost:8000
```

### 方法 4：VS Code 插件
安装 "Live Server" 插件，右键 HTML 文件选择 "Open with Live Server"

---

## 🎯 总结

**对于大多数用户，推荐使用：**

```bash
# 1. 进入项目目录
cd digital-human-component

# 2. 启动服务器
python3 -m http.server 8000

# 3. 打开浏览器
http://localhost:8000/examples/standalone.html
```

**这样你就可以直接使用，无需任何构建工具！** ✨

---

## 📚 更多资源

- [完整 API 文档](README.md#api-文档)
- [示例代码](examples/)
- [GitHub 仓库](https://github.com/zizaijiyihu/digital-human-component)
