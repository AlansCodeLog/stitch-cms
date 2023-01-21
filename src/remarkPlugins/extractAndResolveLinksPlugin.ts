import { castType } from "@alanscodelog/utils"
import path from "path"
import type { Plugin } from "unified"
import type { Node } from "unist-util-visit"
import type { VFile } from "vfile"

import { resolveLinktoDiskResource, visitRecursive } from "../utils.js"


export const extractAndResolveLinksPlugin: Plugin<[{ stripExtensions?: string[], resolver?: (url: string, dir: string, stripExtensions: string[]) => { url: string, extra: string } }]> = ({ stripExtensions = [], resolver = resolveLinktoDiskResource }) => (tree, file) => {
	castType<VFile & { links: string[] }>(file)

	file.links ??= []
	if (file.path === undefined) throw Error("vFile path property must be defined.")
	const filepath = file.path
	const directory = path.parse(filepath).dir

	visitRecursive(tree, "link", (node: Node & { url: string, extra?: string }) => {
		const resolved = resolver(node.url, directory, stripExtensions)
		node.url = resolved.url
		node.extra = resolved.extra
		file.links.push(resolved.url)
	})
	visitRecursive(tree, "image", (node: Node & { url: string, extra?: string }) => {
		const resolved = resolver(node.url, directory, stripExtensions)
		node.url = resolved.url
		node.extra = resolved.extra
		file.links.push(resolved.url)
	})
}
