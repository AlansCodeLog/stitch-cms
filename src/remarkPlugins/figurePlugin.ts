import type { Plugin } from "unified"
import type { Node } from "unist-util-visit"

import { remarkPluginsLogger as logger } from "../logger.js"
import { visitRecursive } from "../utils.js"


export const figurePlugin: Plugin = () => tree => {
	visitRecursive(tree, "image", (node: Node & { title?: string, alt?: string, url: string, children?: any[], depth: number, value: string }) => {
		if (node.title || node.alt) {
			// we want || so if alt is empty, title is used
			// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
			const caption = node.alt || node.title || ""
			node.type = "html"
			node.children = undefined
			node.data ??= {}
			node.data.hName = "figure"
			const hProperties = node.data.hProperties ?? {}
			node.data.hProperties = {
				type: "element",
				src: undefined,
				alt: undefined,
				title: undefined,
			}
			node.data.hChildren = [
				{
					type: "element",
					tagName: "img",
					properties: {
						src: node.url,
						title: node.title,
						alt: node.alt,
						...hProperties,
					},
				},
				{ type: "element", tagName: "figcaption", children: [{ type: "text", value: caption }]},
			]
			logger.verbose(`Converted ${node.url} image to figure/caption with: caption "${caption}"${node.title ? `, node title "${node.title}"` : ""}${node.alt ? `, node alt "${node.alt}"` : ""}}`)
		}
	})
}
