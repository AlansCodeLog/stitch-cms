import { crop, pretty, pushIfNotIn } from "@alanscodelog/utils"
import Prism from "prismjs"
import loadLanguages from "prismjs/components/index.js"
import type { Plugin } from "unified"
import { type Node, visit } from "unist-util-visit"

import { logger } from "../logger.js"

// Always pre-loaded by prism when it's imported.
// Not sure if actually everything is getting dragged because we're using vite as the bundler, but it hardly matters for now, server isn't getting bundled anyways.
const loaded = ["markup", "css", "clike", "javascript"]

// not sure why but the remark-prism package is unbearably slow, had to write my own
// added very quick prism support
// does not parse to html, just bypasses it by using an html node directly
export const prismPlugin: Plugin = (
	{
		langs = [],
	}:
	{
		/** Languages to preload. */
		langs: string[]
	}) => (tree: any) => {
	const toLoad = []
	for (const lang of langs) {
		if (!loaded.includes(lang)) {
			toLoad.push(lang)
		}
	}

	if (toLoad.length > 0) {
		loadLanguages(toLoad)
		pushIfNotIn(loaded, ...toLoad)
	}

	visit(tree, "code", (node: Node & { value: string, lang: string }) => {
		const lang = node.lang
		if (!loaded.includes(lang)) {
			loadLanguages([lang])
			logger.warn(crop`
				prism remark plugin found code block with language "${lang}" which is not in preloaded languages list:
					Loaded: ${pretty(loaded, { oneline: true })}
					Pre-loaded: ${pretty(langs, { oneline: true })}
			`)
		}
		const res = Prism.highlight(node.value, Prism.languages[lang], lang)
		node.value = `<pre class="language-${lang}"><code class="language-${lang}">${res}</code></pre>`
		node.type = "html"
	})
}
