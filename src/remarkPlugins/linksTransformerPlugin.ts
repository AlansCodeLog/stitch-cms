import { keys, readable } from "@alanscodelog/utils"
import type { Plugin } from "unified"
import type { Node } from "unist-util-visit"

import { remarkPluginsLogger as logger } from "../logger.js"
import type { LinkMapperResolve, LinkMapperUnResolve } from "../types.js"
import { visitRecursive } from "../utils.js"


// type Info = {
// 	isImage: boolean
// 	contents: string
// 	linkText?: string
// 	length: number
// }


export const linksTransformerPlugin: Plugin<[
	{ type: "resolve", linkMap: LinkMapperResolve, links: string[] } | { type: "unresolve", linkMap: LinkMapperUnResolve, links: string[] },
]> = ({ type, linkMap, links }) => tree => {
	// node.extra is created by the extract and resolve plugin and the obsidian link plugin, it contains any extra header links
	const visitor = (node: Node & { url: string, extra?: string, type: string, children?: any[], properties: Record<string, any> }): void => {
		logger.debug(`Checking linkMap for "${node.url}", exists: ${linkMap[node.url] !== undefined}.`)

		if (type === "resolve" && linkMap[node.url]) {
			const info = linkMap[node.url]
			links.push(info.id)
			node.url = info.permalink + (node.extra ?? "")
			if (node.type === "image" && info.properties) {
				node.data ??= {}
				node.data.hProperties = { ...(node.data.hProperties ?? {}), ...info.properties }
				logger.verbose(`Detected extra properties on link ${node.url}: ${readable(keys(info.properties))}.`)
			}
			logger.verbose(`Resolved link ${node.url}.`)
		}
		if (type === "unresolve" && linkMap[node.url]) {
			const info = linkMap[node.url]
			links.push(info.id)
			node.url = info.filepath + (node.extra ?? "")
			logger.verbose(`Unresolved link ${node.url}.`)
		}
	}
	visitRecursive(tree, "link", visitor)
	visitRecursive(tree, "image", visitor)
}
