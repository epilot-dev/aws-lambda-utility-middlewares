// rollup.config.js
import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import sourcemaps from 'rollup-plugin-sourcemaps';
import { visualizer } from 'rollup-plugin-visualizer';

import pkg from './package.json';

const extensions = ['.js', '.jsx', '.ts', '.tsx'];

const isProdBuild = process.env.NODE_ENV === 'production';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'lib/cjs/index.js',
      format: 'cjs', // CommonJS format for Node.js
      sourcemap: true,
    },
    {
      file: 'lib/index.js',
      format: 'esm', // ES module format for modern browsers
      sourcemap: true,
    },
  ],
  watch: {
    include: 'src/**',
  },
  plugins: [
    json(),
    typescript(), // Compile TypeScript
    resolve({ preferBuiltins: true, extensions }), // Resolve module paths
    commonjs(), // Convert CommonJS modules to ES6
    sourcemaps(),
    babel({ extensions, include: ['src/**/*'], babelHelpers: 'bundled' }), // Transpile to ES5 and include polyfills
    !isProdBuild &&
      visualizer({
        emitFile: false,
        filename: 'stats.html',
        gzipSize: true,
        brotliSize: true,
        open: false,
      }),
  ],
  external: Object.keys(pkg.peerDependencies || {}), // Don't bundle dependencies
};
