import path from "path"

import { remarkPluginsLogger as logger } from "./logger.js"

// matches ../ or ./ with platform specific path
export const relativePathRegExp = `\\.{1,2}\\${path.sep}`

export function resolveLinktoDiskResource(link: string, directory: string, stripExtensions: string[]): { url: string, extra?: string } {
	if (path.isAbsolute(link)) {
		logger.debug(`Link "${link}" is absolute, ignoring.`)
		return { url: link }
	}

	let parsedLinkUrl: URL | undefined
	try {
		parsedLinkUrl = new URL(link)
		// eslint-disable-next-line no-empty
	} catch (e) { }

	if (parsedLinkUrl && parsedLinkUrl.protocol !== "") {
		logger.debug(`Link "${link}" has a protocol ${parsedLinkUrl.protocol}, ignoring.`)
		return { url: link }
	}

	const parsedLink = path.parse(link)
	const normalized = path.normalize(link)

	let resolvedPath: string
	if (normalized.match(relativePathRegExp) !== null) {
		logger.debug(`Determined normalized link "${normalized}" is relative.`)
		resolvedPath = path.resolve(directory, normalized)
	} else {
		logger.debug(`Determined normalized "${link}" is wiki like link.`)
		const ext = parsedLink.ext === "" || stripExtensions.includes(parsedLink.ext) ? "" : `.${parsedLink.ext}`
		resolvedPath = parsedLink.name + ext
	}
	if (resolvedPath.includes("#")) {
		const index = resolvedPath.indexOf("#")
		const url = resolvedPath.slice(0, index)
		const extra = resolvedPath.slice(index, resolvedPath.length)
		logger.verbose(`Found resource for "${link}" at ${url} with extra params: "${extra}"`)
		return { url, extra }
	}
	logger.verbose(`Found resource for "${link}" at ${resolvedPath}`)
	return { url: resolvedPath }
}

export function generateSafeSlug(string: string): string {
	const res = string.replace(/(\/|\s)/g, "-").replace(/('|"|\(|\)|\[|\]|\?|\+)/g, "").replace(/(-+)/g, "-")
		.toLowerCase()

	return res
}


export function visitRecursive(tree: any, type: string, visitor: (node: any, i: number, parent: any) => void): void {
	let i = 0
	// eslint-disable-next-line prefer-rest-params
	const parents = arguments[4] ?? []
	parents.push(tree)
	if (tree.children !== undefined) {
		for (const child of tree.children) {
			if (child.type === type) {
				visitor(child, i, [...parents])
			}
			if (child.children) (visitRecursive as any)(child, type, visitor, [...parents])
			i++
		}
	}
}

