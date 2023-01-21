// @ts-expect-error-error
import { extract } from "@extractus/oembed-extractor"
import type { Plugin } from "unified"
import { type Node, visit } from "unist-util-visit"

import { type Transformer, transformers } from "./transformers.js"

import { remarkPluginsLogger as logger } from "../../logger.js"


const checkCache = (cache: any, node: any): string | void => {
	if (cache[node.url]) {
		if (cache[node.url] === node.url) {
			logger.warn(`Using cached url which failed to be transformed: ${node.url}`)
		} else {
			logger.verbose(`Using cached embed for ${node.url}`)
		}
		return cache[node.url]
	}
}

const catchError = (node: any, cache: Record<string, string>) => (e: Error) => {
	logger.warn(`Failed to transform ${node.url}`)
	if (e.message.includes("Failed to transform")) {
		cache[node.url] = node.url
	}
	return undefined
}

const logSuccess = (url: string) => (res: any) => {
	logger.verbose(`Retrieved embed for ${url}`)
	return res
}

const getEmbed = async (transformer: Transformer, cache: Record<string, string>, node: any): Promise<string> => {
	const cached = checkCache(cache, node.url)
	if (cached) return cached

	if (transformer.custom) return transformer.custom(node.url)

	return extract(node.url).then((res: any) => res.html)
		.then(logSuccess(node.url))
		.catch(catchError(node, cache))
}

export const embedLinksPlugin: Plugin<[Record<string, string>]> = cache => async tree => {
	const nodesToChange: Promise<any>[] = []
	visit(tree, "paragraph", (parNode: Node & { value?: string, children?: any[], properties: any, data: any }) => {
		if ((parNode.children?.length ?? 2) > 1) return // link must be on it's own line

		visit(parNode, "link", (node: Node & { url: string, type: string, value?: string, children?: any[], data?: any }) => {
			for (const transformer of transformers) {
				let embedHtml: Promise<string> | string | undefined

				if (!embedHtml && transformer.include) {
					for (const subtransformer of transformer.include) {
						if (node.url.startsWith(subtransformer)) {
							embedHtml = getEmbed(transformer, cache, node)
							break
						}
					}
				}
				if (!embedHtml && transformer.regex && node.url.match(transformer.regex) !== null) {
					embedHtml = getEmbed(transformer, cache, node)
					break
				}

				if (embedHtml) {
					nodesToChange.push((async () => {
						const value = typeof embedHtml === "string" ? embedHtml : await embedHtml

						const url = node.url
						parNode.data = {
							...(parNode.data ?? {}),
							hProperties: {
								...(parNode?.data?.hProperties ?? {}),
								className: [
									...(parNode?.data?.hProperties?.className ?? []),
									"embed",
									`${transformer.name}-embed`,
								],
							},
						}
						// TODO
						node.value = value
						node.type = "html"

						cache[url] = value
						logger.verbose(`Found embed for ${url}`)
					})())
				}
			}
		})
	})
	await Promise.all(nodesToChange)
}
