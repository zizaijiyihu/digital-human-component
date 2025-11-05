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
                'three': 'THREE'
            }
        },
        external: ['three'],
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
                'three': 'THREE'
            }
        },
        external: ['three'],
        plugins: [resolve(), terser()]
    },
    // ES Module 格式
    {
        input: 'src/index.js',
        output: {
            file: 'cdn/digital-human.esm.js',
            format: 'es'
        },
        external: ['three'],
        plugins: [resolve()]
    }
];
