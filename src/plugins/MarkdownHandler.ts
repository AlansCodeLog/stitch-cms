import { crop, indent, keys, pretty } from "@alanscodelog/utils"
// import remarkPresetLintRecommended from "remark-preset-lint-recommended"
import crypto from "crypto"
import { type Stats, promises as fs } from "fs"
import path from "path"
import { performance } from "perf_hooks"
import rehypeKatex from "rehype-katex"
// import rehypeParse from "rehype-parse"
// import rehypeRemark from "rehype-remark"
import rehypeStringify from "rehype-stringify"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { type Processor, unified } from "unified"
import type { Node } from "unist-util-visit"
import { VFile } from "vfile"

import { ContentHandler } from "../ContentHandler.js"
import { logger } from "../logger.js"
import { embedLinksPlugin, extractAndResolveLinksPlugin, extractFirstHeading, figurePlugin, linksTransformerPlugin, obsidianLinksPlugin, parseYamlPlugin, prismPlugin } from "../remarkPlugins/index.js"
import type { ContentEntry, ContentMetadata, InternalContentEntry, LinkMapperResolve, LinkMapperUnResolve } from "../types.js"
import { generateSafeSlug, resolveLinktoDiskResource } from "../utils.js"


export type ContentFile = {
	vfile: VFile & { metadata: Partial<ContentMetadata>, firstHeading?: string, links: string[] }
	hash: string
	parsed: Node
	_parsableProperties: Record<string, {
		parsed: Node
		vfile: VFile & { links: string[] }
	}>
}

export type LinkTransformer = (filepath: string, permalink: string, properties?: Record<string, any>) => any
export class MarkdownHandler<T extends ContentFile = ContentFile> extends ContentHandler<T> {
	// parser is defined when cache loads so we can pass it the cache
	private parser!: Processor
	private compileParser!: Processor
	private readonly parsableProperties: string[] = ["thumbnail_caption"]
	private readonly resolvableProperties: Record<string, LinkTransformer | true> = { thumbnail: true }
	private readonly stripExtensions: string[] = ["md"]
	private readonly permalink: string | ((name: string, ext: string, metadata: ContentMetadata) => string) = "/post/"
	cache: { links: Record<string, string>, content: Record<string, any> } = { links: {}, content: {} }
	type: string = "post"
	constructor(
		{ globs, permalink, type, cache, parsableProperties, resolvableProperties, stripExtensions }:
		{
			globs: MarkdownHandler<T>["globs"]
			/** The permalink base, e.g. `/post/`, in which case the permalinks will look like `/post/slug` or a function that returns the permalink. */
			permalink?: MarkdownHandler<T>["permalink"]
			/**
			 * The default type for posts processed by this plugin. The default is `post`. A file can change this by setting a type property in it's yaml header.
			 *
			 * For example, a page could set it's type to `page` and later you can filter these out when querying the server.
			 */
			type?: MarkdownHandler<T>["type"]
			/** Whether to enable the cache. */
			cache?: MarkdownHandler<T>["cacheEnabled"]
			/** Whether to enable the cache. */
			parsableProperties?: MarkdownHandler<T>["parsableProperties"]
			/**
			 * A record of additional properties that can be resolved. The default is `{thumbnail:true}` to enable thumbnail paths to be resolved.
			 *
			 * Properties can also be custom functions that returns the resolved path and optionally properties to set on the resource. See {@link InternalContentEntry.properties}
			 */
			resolvableProperties?: MarkdownHandler<T>["resolvableProperties"]
			/** A list of extensions to strip from the filename before creating the slug. The default is `[md]`. */
			stripExtensions?: MarkdownHandler<T>["stripExtensions"]
		}
	) {
		super("markdown plugin", globs)
		if (permalink) this.permalink = permalink
		if (cache !== undefined) this.cacheEnabled = cache
		if (type) this.type = type
		if (parsableProperties) this.parsableProperties = parsableProperties
		if (resolvableProperties) this.resolvableProperties = resolvableProperties
		if (stripExtensions) this.stripExtensions = stripExtensions
	}

	override async onCacheLoad(): Promise<void> {
		this.parser = unified()
			.use(remarkParse)
			.use(remarkGfm, { singleTilde: false, tablePipeAlign: false })
			.use(remarkMath, { singleDollarTextMath: false })
			.use(remarkFrontmatter, { type: "yaml", fence: "---" })
			.use(parseYamlPlugin)
			.use(embedLinksPlugin, this.cache.links)
			.use(obsidianLinksPlugin)
			.use(extractFirstHeading)
			.use(extractAndResolveLinksPlugin, { stripExtensions: this.stripExtensions })
		this.compileParser = unified()
			.use(figurePlugin)
			.use(prismPlugin, { langs: ["js", "rust", "python", "cpp"]})
			.use(remarkRehype, { allowDangerousHtml: true })
			.use(rehypeKatex)
			.use(rehypeStringify, { allowDangerousHtml: true })
	}
	override async parse(filepath: string, stats?: Stats): Promise<ContentEntry<T>> {
		const parsedPath = path.parse(filepath)

		const hash = crypto.createHash("md5").update(filepath + (stats?.mtime ?? new Date()).toISOString()).digest("hex")

		let content: T = {} as T

		if (this.cache.content[hash] && this.cacheEnabled) {
			content = this.cache.content[hash]
			logger.verbose(`Using Cache for ${filepath}`)
		} else {
			const file = (await fs.readFile(filepath)).toString()
			const vfile = new VFile({ value: file, path: filepath, metadata: {} })

			// create new copy if reusing parser
			const start = performance.now()
			logger.verbose(`Parsing ${parsedPath.name}.`)

			const parsed = this.parser.parse(vfile)
			const transformed = (await this.parser.run(parsed, vfile))

			content.vfile = vfile as any
			content.parsed = transformed

			const vfileMetadata = content.vfile.metadata

			const parsableProps = (await Promise.all(this.parsableProperties.map(async property => {
				const value = vfileMetadata[property as keyof typeof vfileMetadata]
				if (value !== undefined) {
					const vFileProp = new VFile({ value, path: `${filepath}:${property}` })
					const parsedProp = this.parser.parse(vFileProp)
					const transformedProp = await this.parser.run(parsedProp, vFileProp)
					const res: [key: string, value: ContentFile["_parsableProperties"][string]] =
							[property, { parsed: transformedProp, vfile: vFileProp as VFile & { links: string[] } }]
					return res
				}
				return undefined
			}))).filter(entry => entry !== undefined) as any


			content._parsableProperties = Object.fromEntries(
				parsableProps
			)

			this.cache.content[hash] = content
			this.cache.content[hash].vfile.value = vfile.result

			logger.verbose(`Parsed ${parsedPath.name} in ${((performance.now() - start) / 1000).toFixed(2)}s`)
		}

		const links = content.vfile.links

		const vfileMetadata = content.vfile.metadata

		const title = vfileMetadata?.title ?? content.vfile.firstHeading ?? parsedPath.name
		content.hash = hash
		const slug = vfileMetadata.slug ?? generateSafeSlug(title)

		const metadata = this.createMetadata({
			title,
			publish: false,
			tags: [],
			type: this.type,
			...vfileMetadata,
			filepath,
			slug,
			permalink: "",
			date: vfileMetadata?.date !== undefined ? new Date(vfileMetadata.date) : stats?.ctime,
		})
		const directory = path.parse(filepath).dir
		for (const property of keys(this.resolvableProperties)) {
			const value = metadata.extra[property as keyof typeof vfileMetadata]
			if (value !== undefined) {
				const res = resolveLinktoDiskResource(value, directory, this.stripExtensions)
				metadata.extra[property as keyof typeof vfileMetadata] = res
				links.push(res.url)
			}
		}
		const permalink = typeof this.permalink === "function" ? this.permalink(slug, parsedPath.ext, metadata) : `${this.permalink}${slug}`
		metadata.permalink = permalink

		return { filepath, id: parsedPath.name, metadata, permalink, links, file: content, output: undefined }
	}
	override async compile(entry: InternalContentEntry<T>): Promise<ContentEntry<T>> {
		const start = performance.now()
		logger.verbose(`Compiling ${entry.id}`)

		const transformed = await this.compileParser.run(entry.file.parsed, entry.file.vfile)

		const compiled = await this.compileParser.stringify(transformed, entry.file.vfile) as string

		await Promise.all(Object.entries(entry.file._parsableProperties).map(async ([prop, propEntry]) => {
			const compiledProp = (await this.compileParser.stringify(await this.compileParser.run(propEntry.parsed, propEntry.vfile), propEntry.vfile)) as string
			(entry.metadata.extra)[prop] = compiledProp
		}))

		logger.verbose(`Compiled ${entry.id} in ${((performance.now() - start) / 1000).toFixed(2)}s`)
		entry.output = compiled.toString()

		return entry as ContentEntry<T>
	}
	override async resolve(entry: InternalContentEntry<T>, linkMap: LinkMapperResolve): Promise<string[]> {
		const start = performance.now()
		logger.verbose(crop`
			Resolving links for ${entry.id}:
				${indent(pretty(Object.keys(linkMap)), 4)}
		`)
		const links: string[] = []

		const resolveTransformer = unified()
			.use(linksTransformerPlugin, { type: "resolve", linkMap, links })

		for (const [property, resolver] of Object.entries(this.resolvableProperties)) {
			const metadata = entry.metadata.extra
			const value = (metadata)[property]
			if (value !== undefined && linkMap[value as string]) {
				const permalink = linkMap[value].permalink
				metadata[property] = typeof resolver === "function"
					? resolver(value, permalink, linkMap[value].properties)
					: { permalink: linkMap[value].permalink, properties: linkMap[value].properties }
			}
		}

		const transformed = (await resolveTransformer.run(entry.file.parsed, entry.file.vfile))
		entry.file.parsed = transformed

		await Promise.all(Object.values(entry.file._parsableProperties).map(async propEntry => {
			const transformedProp = (await resolveTransformer.run(propEntry.parsed, propEntry.vfile))
			propEntry.parsed = transformedProp
		}))
		logger.verbose(`Resolved links in ${((performance.now() - start) / 1000).toFixed(2)}s`)
		return links
	}
	override async unresolve(entry: InternalContentEntry<T>, linkMap: LinkMapperUnResolve): Promise<string[]> {
		logger.verbose(`Unresolving ${pretty(linkMap, { oneline: true })} for ${entry.id}`)
		const links: string[] = []
		const unResolveTransformer = unified()
			.use(linksTransformerPlugin, { type: "unresolve", linkMap, links })

		for (const property of keys(this.resolvableProperties)) {
			const metadata = entry.metadata.extra
			const value = (metadata)[property]
			if (value !== undefined && linkMap[value as string]) {
				metadata[property] = linkMap[value].id
			}
		}


		const transformed = (await unResolveTransformer.run(entry.file.parsed, entry.file.vfile))
		entry.file.parsed = transformed

		await Promise.all(Object.values(entry.file._parsableProperties).map(async propEntry => {
			const transformedProp = (await unResolveTransformer.run(propEntry.parsed, propEntry.vfile))
			propEntry.parsed = transformedProp
		}))

		return links
	}

	override async onDelete(entry: InternalContentEntry<T>): Promise<any> {
		delete this.cache.content[entry.file.hash]
	}
}
