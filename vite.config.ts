import { run } from "@alanscodelog/utils/node"
import { babel } from "@rollup/plugin-babel"
import glob from "fast-glob"
import { builtinModules } from "module"
import path from "path"
import type { PluginOption } from "vite"
import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

import packageJson from "./package.json"


const typesPlugin = (): PluginOption => ({
	name: "typesPlugin",
	// eslint-disable-next-line no-console
	writeBundle: async () => run("npm run build:types").catch(e => console.log(e)).then(() => undefined),
})

// https://vitejs.dev/config/
export default ({ mode }: { mode: string }) => defineConfig({
	plugins: [
		babel({
			babelHelpers: "runtime",
			extensions: [".js", ".mjs", "ts"],
			presets: [
				["@babel/preset-env", {
					modules: false,
					useBuiltIns: "usage",
					debug: true,
					corejs: packageJson.dependencies["core-js"].slice(1, 4),
				}],
			],
			plugins: ["@babel/plugin-transform-runtime"],
		}),
		// even if we don't use aliases, this is needed to get imports based on baseUrl working
		tsconfigPaths(),
		typesPlugin(),
	],
	build: {
		outDir: "dist",
		lib: {
			entry: glob.sync(path.resolve(__dirname, "src/**/*.ts"), { ignore: ["test.ts"]}),
			formats: ["es", "cjs"],
			fileName: (format, entryName) => {
				const suffix = format === "es" ? "js" : "cjs"
				return `${entryName}.${suffix}`
			},
		},
		rollupOptions: {
			external: [...builtinModules, ...Object.keys((packageJson as any).dependencies ?? {}), ...Object.keys((packageJson as any).peerDependencies ?? {}), /@babel\/runtime/],
			output: {
				preserveModulesRoot: "src",
				preserveModules: true,
			},
		},
		...(mode === "production" ? {
			minify: false,
		} : {
			minify: false,
			sourcemap: "inline",
		}),
	},
	resolve: {
		alias: [
		],
	},
	server: {
		watch: {
			// watch changes in linked repos
			ignored: ["!**/node_modules/@alanscodelog/**"],
		},
	},
})
