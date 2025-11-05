import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';

export default [
    // UMD 格式（浏览器直接使用）
    {
        input: 'src/index.js',
        output: {
            file: 'cdn/digital-human.js',
            format: 'umd',
            name: 'DigitalHuman',
            globals: {
                'three': 'THREE',
                'three/addons/loaders/GLTFLoader.js': 'THREE',
                'three/addons/controls/OrbitControls.js': 'THREE'
            }
        },
        external: [
            'three',
            'three/addons/loaders/GLTFLoader.js',
            'three/addons/controls/OrbitControls.js'
        ],
        plugins: [resolve()]
    },
    // UMD 压缩版
    {
        input: 'src/index.js',
        output: {
            file: 'cdn/digital-human.min.js',
            format: 'umd',
            name: 'DigitalHuman',
            globals: {
                'three': 'THREE',
                'three/addons/loaders/GLTFLoader.js': 'THREE',
                'three/addons/controls/OrbitControls.js': 'THREE'
            }
        },
        external: [
            'three',
            'three/addons/loaders/GLTFLoader.js',
            'three/addons/controls/OrbitControls.js'
        ],
        plugins: [resolve(), terser()]
    },
    // ES Module 格式
    {
        input: 'src/index.js',
        output: {
            file: 'cdn/digital-human.esm.js',
            format: 'es'
        },
        external: [
            'three',
            'three/addons/loaders/GLTFLoader.js',
            'three/addons/controls/OrbitControls.js'
        ],
        plugins: [resolve()]
    }
];
