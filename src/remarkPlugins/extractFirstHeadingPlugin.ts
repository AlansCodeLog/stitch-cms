import { castType } from "@alanscodelog/utils"
import type { Plugin } from "unified"
import { type Node, visit } from "unist-util-visit"
import type { VFile } from "vfile"

import { remarkPluginsLogger as logger } from "../logger.js"


export const extractFirstHeading: Plugin = () => (tree, vfile) => {
	visit(tree, "heading", (headingNode: Node & { depth: number, value: string }) => {
		castType<VFile & { firstHeading: string }>(vfile)
		if (vfile.firstHeading) return
		if (headingNode.depth === 1) {
			visit(headingNode, "text", (node: Node & { depth: number, value: string }): void => {
				logger.verbose(`Found first heading ${node.value}`)
				vfile.firstHeading = node.value
			})
		}
	})
}
