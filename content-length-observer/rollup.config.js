// rollup.config.js
import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import babel from "@rollup/plugin-babel";
import pkg from "./package.json";

const extensions = [".js", ".jsx", ".ts", ".tsx"];

export default {
  input: "src/index.ts", // Path to the entry point of your project
  output: [
    {
      file: "lib/cjs/index.js",
      format: "cjs", // CommonJS format for Node.js
      sourcemap: true,
    },
    {
      file: "lib/index.js",
      format: "esm", // ES module format for modern browsers
      sourcemap: true,
    },
  ],
  plugins: [
    typescript(), // Compile TypeScript
    resolve({ extensions }), // Resolve module paths
    commonjs(), // Convert CommonJS modules to ES6
    babel({ extensions, include: ["src/**/*"], babelHelpers: "bundled" }), // Transpile to ES5 and include polyfills
  ],
  external: Object.keys(pkg.dependencies || {}), // Don't bundle dependencies
};
