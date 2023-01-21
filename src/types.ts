import type { DataApi } from "datasources/dataApi.js"

import type { Entry } from "./generated/index.js"

// dummy named types
export type ContentId = string
export type ContentPermalink = string
export type ContentFilepath = string
export type ContentFilenme = string
export type Resource = {}

export type RoutesInfo = {
	tags: ({ name: string, slug: string, count: number })[]
	count: number
}

export type ContentFilter = (entry: Entry) => boolean

/**
 * Metadata that is understood by the server for filtering.
 *
 * Basic stuff like `filepath`, `title`, `slug`, etc, and also properties that can be extracted from the file header that are supported such as `publish`, `thumbnail`, `permalink`.
 */
// TODO? make generic
export type ContentMetadata = Omit<Entry, "content" | "__typename">

export type InternalContentEntry<TFile> = {
	/** Some metadata for querying that {@link ContentHandler.parse} can fill out. {@link ContentHandler.createMetadata} is available for quickly filling out optional properties. */
	metadata: ContentMetadata
	/**
	 * A list of partially "resolved" links in the file. By resolved, we mean, any relative paths have been turned to absolute paths, otherwise left alone because they are wiki/obsidian like links.
	 *
	 * Should NOT return any urls.
	 */
	links: string[]
	/**
	 * {@link ContentHandler.parse} should just return an empty array. This will be managed automatically.
	 */
	readonly linkedBy: string[] // files that depend on where it was used as a link
	/** Whatever internal representation and information for the file that you need. */
	file: TFile
	/**
	 * Some id the file can be uniquely identified and globally linked by for wiki/obsidian like links.
	 *
	 * There is built in duplicate detection to avoid problems.
	 *
	 * Usually this is a post's title or in the case of other files `{filename}.{ext}`
	 */
	id: ContentId
	/**
	 * The filepath as passed to {@link ContentHandler.parse}
	 */
	filepath: ContentFilepath
	/**
	 * The file's final permalink. Needs to be returned by {@link ContentHandler.parse}.
	 *
	 * The idea is one has different plugins for different permalink paths.
	 *
	 * So all posts go to `/post/...` and are handled by plugin X and all resources go to `/resources/...` and are handled by plugin Y and so on.
	 *
	 * Plugins can use whatever methods they want to determine it and should allow overriding it via metadata.permalink.
	 */
	permalink: ContentPermalink
	/**
	 * Any additional properties a linking link should set on itself if it wants (for example, for images, srcset and sizes).
	 */
	properties?: Record<string, any>
	/** {@link ContentHandler.compile}'s string output. Can be empty before the compile step, otherwise it's assumed to be defined. */
	output?: string
}

/** @internal */
export type ParseCache = {
	content: Record<string, any>
	links: Record<string, string>
	resources: Record<string, Resource>
}

export type ContentEntry<T> = Omit<InternalContentEntry<T>, "linkedBy">
/** @internal */
export type LinkMapperResolve = Record<ContentFilepath, { permalink: ContentPermalink, id: ContentId, properties?: Record<string, any> }>
/** @internal */
export type LinkMapperUnResolve = Record<ContentPermalink, { filepath: ContentFilepath, id: ContentId, properties?: Record<string, any> }>

/** @internal */
export type PermalinkMapper = Record<string, string>
/** @internal Do not move this without changin it's import line in ./codegen.yml */
export interface AppContext {
	dataSources: {
		dataApi: DataApi<any>
	}
}
