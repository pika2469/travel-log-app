import { defineConfig } from 'vite';
import {resolve} from 'path';

export default defineConfig({
    base: './', // 相対パスで出力
    resolve: {
        alias: {
            leaflet: '/node_modules/leaflet/dist/leaflet.js',
        },
    },
    build: {
        outDir: 'docs',
        // マルチページ対応
        input: {
            index: resolve(__dirname, 'index.html'),
            register: resolve(__dirname, 'register.html'),
        },
    },

});