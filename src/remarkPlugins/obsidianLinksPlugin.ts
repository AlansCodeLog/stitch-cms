import type { Plugin } from "unified"
import type { Node } from "unist-util-visit"

import { visitRecursive } from "../utils.js"


const linkRegex = new RegExp(
	`(!?)` + // for ![[images]]
	`\\[\\[` + // start of link
	`(` +
		`(?:\\\\.|[^\\[\\]])` + // any escaped charager or any none [] character
	`*?)` +
	`\\]\\]` // end of link
	, "g")
const linkTextRegex = new RegExp(
	`((?:\\\\.|[^\\|])*?)` + // any escaped characters or any none | characters
	`\\|` + // separator
	`(.*)` // alt text
)

import { remarkPluginsLogger as logger } from "../logger.js"


export const obsidianLinksPlugin: Plugin<[]> = () => async tree => {
	const nodesToChange: Promise<any>[] = []

	visitRecursive(tree, "text", (node: Node & { value: string }, parentIndex: number, parents: any) => {
		const parent = parents[parents.length - 1]
		const linkMatches = node.value.matchAll(linkRegex)

		const nodesToCreate = []
		let last = 0
		for (const linkMatch of linkMatches) {
			const isImage = linkMatch[1] !== ""
			let contents = linkMatch[2]
			let extra
			let linkText: string | undefined

			const linkTextMatch = contents.match(linkTextRegex)
			if (!isImage && linkTextMatch) {
				contents = linkTextMatch[1]
				linkText = linkTextMatch[2]
			}
			if (contents.includes("#")) {
				const index = contents.indexOf("#")
				extra = contents.slice(index, contents.length)
				contents = contents.slice(0, index)
			}
			logger.verbose(`Found obsidian like ${isImage ? "image link" : "link"} "${contents}" ${linkText ? `with text: "${linkText}"` : ""}`)

			if (last !== linkMatch.index) {
				const value = node.value.slice(last, linkMatch.index)
				logger.debug(`Creating text node from ${last} to ${linkMatch.index!}: ${value}`)
				nodesToCreate.push({ type: "text", value, extra })
				last = linkMatch.index!
			}
			if (isImage) {
				logger.debug(`Creating image node: ${contents}`)
				nodesToCreate.push({ type: "image", url: contents, extra })
			} else {
				logger.debug(`Creating link node: ${contents}`)
				nodesToCreate.push({ type: "link", url: contents, extra, title: linkText ?? contents, children: [{ type: "text", value: linkText }]})
			}
			last += linkMatch[0].length
		}
		if (last < node.value.length) {
			const value = node.value.slice(last, node.value.length)
			logger.debug(`Creating text node from ${last} to ${node.value.length}: ${value}`)
			nodesToCreate.push({ type: "text", value })
		}

		parent.children.splice(parentIndex, 1, ...nodesToCreate)
		logger.debug(parent)
	})

	await Promise.all(nodesToChange)
}
