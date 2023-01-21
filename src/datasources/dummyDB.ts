import { type AnyFunction, type Throttled, castType, crop, debounce, dedupe, pick, pushIfNotIn, readable, setReadOnly, throttle, unreachable } from "@alanscodelog/utils"
import chokidar from "chokidar"
import fsSync from "fs"
import fs from "fs/promises"
import { performance } from "perf_hooks"
import picomatch from "picomatch"

import type { ContentHandler } from "../ContentHandler.js"
import type { Entry } from "../generated/index.js"
import { logger } from "../logger.js"
import type { ContentFilter, InternalContentEntry, LinkMapperResolve, LinkMapperUnResolve, RoutesInfo } from "../types.js"
import { generateSafeSlug } from "../utils.js"


export class DummyDb {
	cachePath: string
	cache: Record<string, any> = { }
	cacheEnabled: boolean = true
	setCache: Throttled<DummyDb["setCacheUnthrottled"]> = throttle(this.setCacheUnthrottled, 5000, { trailing: true })
	plugins: ContentHandler[]
	filePluginMap: Map<string, ContentHandler> = new Map()
	/** Entries mapped by their id. */
	contentMap: Map<string, InternalContentEntry<any>> = new Map()
	/** Entries mapped by their filepath. */
	fileMap: Map<string, InternalContentEntry<any>> = new Map()
	ignore: string[]
	// set by async init
	chokidar!: chokidar.FSWatcher
	ready!: Promise<any>
	isReady: boolean = false
	constructor({
		plugins,
		ignore,
		cache,
		cachePath,
	}: {
		plugins: ContentHandler[]
		cachePath: string
		cache?: boolean
		ignore?: string[]
	}) {
		this.plugins = plugins
		this.ignore = ["**/*.git", "**/node_modules", "**/.*", ...(ignore ?? [])]
		this.cacheEnabled = cache ?? this.cacheEnabled
		this.cachePath = cachePath
	}
	async init(): Promise<void> {
		const start = performance.now()
		let resolve: AnyFunction
		const initialPromises: any[] = []
		let ready = false
		this.ready = new Promise(_resolve => {
			resolve = _resolve
		}).then(() => {
			this.isReady = true
		})

		await this.getCache()

		const globs = []
		for (const plugin of this.plugins) {
			this.cache[plugin.name] ??= plugin.cache
			plugin.cache = this.cache[plugin.name]
			if (plugin.cacheEnabled === undefined) plugin.cacheEnabled = this.cacheEnabled
			initialPromises.push(plugin.onCacheLoad())
			for (const glob of plugin.globs) {
				globs.push(glob)
			}
		}
		logger.info(`Scanning globs ${readable(globs)}`)


		const boundHandleAdd = this._handleAdd.bind(this)
		const boundHandleDelete = this._handleDelete.bind(this)
		const boundHandleChange = this._handleChange.bind(this)

		// chokidar ready seems unreliable
		// this works as a single debounce function
		// it will get called as chokidar adds things and we're not ready
		// until there's been a 5 second wait where nothing has been added
		const fakeReady = debounce(async () => {
			if (!ready) {
				logger.info(`Initial Scan Complete. Started processing ${initialPromises.length} files.`)
				ready = true
				await Promise.allSettled(initialPromises)
				logger.verbose(`Dummy DB is ready to take requests. Processed all files in ${((performance.now() - start) / 1000).toFixed(2)}s`)
				void this.setCacheUnthrottled()
				resolve()
			}
		}, 5000, { leading: false, trailing: true })

		this.chokidar = chokidar
			.watch(globs, {
				persistent: true,
				ignored: filepath => picomatch.isMatch(filepath, this.ignore, { dot: true }),
				awaitWriteFinish: true,
			})
			.on("error", error => logger.error(`Chokidar Error`, { error }))
			.on("add", (filepath, stats) => {
				const promise = boundHandleAdd(filepath, stats)
				if (!ready) {
					initialPromises.push(promise)
					void fakeReady()
				}
			})
			.on("unlink", filepath => {
				const promise = boundHandleDelete(filepath)
				if (!ready) {
					initialPromises.push(promise)
					void fakeReady()
				}
			})
			.on("change", (filepath, stats) => {
				const promise = boundHandleChange(filepath, stats)
				if (!ready) {
					initialPromises.push(promise)
					void fakeReady()
				}
			})
			// TODO check directory unlink calls per file unlink
			.on("addDir", dirpath => logger.verbose(`Directory ${dirpath} has been added`))
			.on("unlinkDir", dirpath => logger.verbose(`Directory ${dirpath} has been removed`))
	}
	private _getFileHandler(filepath: string): ContentHandler {
		for (const plugin of this.plugins) {
			const matches = plugin.globs.find(glob => picomatch.isMatch(filepath, glob))

			if (matches) {
				let handlerPlugin = this.filePluginMap.get(filepath)
				if (handlerPlugin && handlerPlugin !== plugin) {
					throw new Error(crop`
						Two different plugins (${plugin.name} and ${handlerPlugin.name}) match the same file ${filepath}. Please change the globs so that they don't handle the same files.
					`)
				}
				if (handlerPlugin === undefined) {
					this.filePluginMap.set(filepath, plugin)
					handlerPlugin = plugin
				}
				return handlerPlugin
			}
		}
		unreachable(`Could not find handler for entry ${filepath}. This can sometimes happen if a glob  has multiple slashes in it. chokidar will happily ignore them and load the file anyways, but when we use picomatch to check which handler's glob matches, it doesn't, resulting in no handler being found.`)
	}
	private _modifyLinkedBy(type: "resolve" | "unresolve", entry: InternalContentEntry<any>, otherEntry: InternalContentEntry<any>): void {
		if (type === "resolve") {
			pushIfNotIn(entry.linkedBy, otherEntry.id)
		} else {
			const index = entry.linkedBy.indexOf(otherEntry.id)
			entry.linkedBy.splice(index, 1)
		}
	}
	/**
	 * Attempt to resolve links to the given entry if they link to it by the given paths.
	 */
	private async _resolveOrUnresolveLinkedBy(type: "resolve" | "unresolve", entry: InternalContentEntry<any>, resolvablePaths: string[]): Promise<void> {
		const promises = []
		for (const otherEntry of this.contentMap.values()) {
			const otherEntryHandler = this.filePluginMap.get(otherEntry.filepath)!
			const resolvableLinks = dedupe(otherEntry.links
				.filter(maybeDependant => resolvablePaths.includes(maybeDependant)), { mutate: true })
			if (resolvableLinks.length === 0) continue
			// careful object.fromEntries is not typed yet
			type LinkMap = typeof type extends "resolve" ? LinkMapperResolve : LinkMapperUnResolve
			const linkMap: LinkMap = Object.fromEntries(resolvableLinks
				.map(link => type === "resolve" ? [link, pick(entry, ["permalink", "id", "properties"])] : [entry.permalink, pick(entry, ["filepath", "id", "properties"])])
			)
			promises.push((async () => {
				const links = await otherEntryHandler[type](otherEntry, linkMap as any)
				if (links.length > 0) this._modifyLinkedBy(type, entry, otherEntry)
				await otherEntryHandler.compile(otherEntry)
			})())
		}
		await Promise.all(promises)
	}
	private async _resolveOrUnresolveLinks(type: "resolve" | "unresolve", entry: InternalContentEntry<any>, handler: ContentHandler): Promise<void> {
		// careful object.fromEntries is not typed yet
		type LinkMap = typeof type extends "resolve" ? LinkMapperResolve : LinkMapperUnResolve
		let someFound = false
		const linkMap: LinkMap = Object.fromEntries(entry.links
			.map(link => {
				const otherEntry = this._getEntryByLink(link)
				if (otherEntry) {
					someFound = true
					return type === "resolve"
						? [link, pick(otherEntry, ["permalink", "id", "properties"])]
						: [otherEntry.permalink, pick(otherEntry, ["filepath", "id", "properties"])]
				}
				return undefined
			})
			.filter(otherEntry => otherEntry !== undefined) as string[][])

		if (someFound) {
			const links = await handler[type](entry, linkMap as any)
			if (links.length > 0) {
				for (const link of links) {
					const otherEntry = this.contentMap.get(link)
					if (!otherEntry) unreachable()
					this._modifyLinkedBy(type, otherEntry, entry)
				}
			}
		}
		// compile should be called after
	}
	private _getEntryByLink(link: string): InternalContentEntry<any> | void {
		if (this.contentMap.has(link)) return this.contentMap.get((link))
		else if (this.fileMap.has(link)) return this.fileMap.get(link)
	}
	private _checkIsNotDuplicate(entry: InternalContentEntry<any>): void {
		const other = this.contentMap.get(entry.id)
		if (other && other.filepath !== entry.filepath) {
			throw new Error(crop`
				Two files that resolve to the same a id ${entry.id}, please rename one:
					${entry.filepath}
					${other.filepath}
			`)
		} else if (other) {
			unreachable()
		}
	}
	private async _handleAdd(filepath: string, stats?: fsSync.Stats): Promise<void> {
		logger.verbose(`Adding ${filepath}`)

		const handler = this._getFileHandler(filepath)
		const entry = await handler.parse(filepath, stats)
		castType<InternalContentEntry<any>>(entry)
		setReadOnly(entry, "linkedBy", [])


		this._checkIsNotDuplicate(entry)
		this.contentMap.set(entry.id, entry)
		this.fileMap.set(filepath, entry)
		const resolvablePaths = [entry.id, entry.filepath]
		await this._resolveOrUnresolveLinkedBy("resolve", entry, resolvablePaths)
		await this._resolveOrUnresolveLinks("resolve", entry, handler)
		await handler.compile(entry)
		this.setCache()
		logger.info(`Added ${entry.id}`)
	}

	private async _handleChange(filepath: string, stats?: fsSync.Stats): Promise<void> {
		// TODO handle this more elegantly
		await this._handleDelete(filepath, { skipCacheSave: true })
		await this._handleAdd(filepath, stats)
	}
	private async _handleDelete(filepath: string, { skipCacheSave }: { skipCacheSave?: boolean } = {}): Promise<void> {
		const handler = this._getFileHandler(filepath) // for the checks
		const entry = this.fileMap.get(filepath)
		if (entry === undefined) unreachable()
		const resolvablePaths = [entry.id, entry.filepath]

		await this._resolveOrUnresolveLinkedBy("unresolve", entry, resolvablePaths)
		await this._resolveOrUnresolveLinks("unresolve", entry, handler)
		await handler.onDelete(entry)
		this.fileMap.delete(filepath)
		this.contentMap.delete(entry.id)
		if (!skipCacheSave) this.setCache()
	}
	async getCache(): Promise<void> {
		if (!this.cacheEnabled) {
			return
		}
		if (fsSync.existsSync(this.cachePath)) {
			const rawCache = (await fs.readFile(this.cachePath)).toString()
			try {
				const parsedCache = JSON.parse(rawCache)
				this.cache = { ...this.cache, ...parsedCache }
				logger.info(`Loaded cache from: ${this.cachePath}`)
			} catch (e) {
				logger.error(`Error reading cache. at ${this.cachePath}`, { error: e })
			}
		}
	}
	async setCacheUnthrottled(): Promise<void> {
		/**
		 * exclude the cache of plugins that have caching disabled
		 * they might still be using temporary caching though so we don't want to delete the properties
		 * nothing will happen if we do, but it's nice to be able to inspect the global state from the DB
		 */
		const cacheClone = { ...this.cache }
		for (const plugin of this.plugins) {
			if (!plugin.cacheEnabled) {
				delete cacheClone[plugin.name]
			}
		}
		logger.verbose(`Writing cache to: ${this.cachePath}`)

		await fs.writeFile(this.cachePath, JSON.stringify(cacheClone, null, "")).catch(error => {
			logger.error(`Error writing cache to ${this.cachePath}.`, { error })
		})
	}
	async getReady(): Promise<boolean> {
		await this.ready
		return this.isReady
	}
	async getEntries(filters: ContentFilter[]): Promise<Entry[]> {
		await this.ready
		const earliestDate = new Date(-8640000000000000)
		const data: Entry[] = [...this.contentMap.values()]
			.map(entry => ({ ...entry.metadata, content: entry.output } as Entry))
			.filter(entry => filters.find(filter => !filter(entry)) === undefined)
			.sort((a, b) => (b.date ?? earliestDate) - (a.date ?? earliestDate))

		return data
	}
	async getRoutesInfo(filters: ContentFilter[]): Promise<RoutesInfo> {
		await this.ready
		const data: Entry[] = [...this.contentMap.values()]
			.map(entry => ({ ...entry.metadata, content: entry.output } as Entry))
			.filter(entry => filters.find(filter => !filter(entry)) === undefined)


		const res: RoutesInfo = {
			count: data.length,
			tags: {} as any,
		}
		const tags: string[] = []
		for (const entry of data) {
			pushIfNotIn(tags, ...entry.tags)
		}
		res.tags = tags.map(tag => {
			const count = data.filter(post => post.tags.includes(tag)).length
			return { name: tag, count, slug: generateSafeSlug(tag) }
		})

		return res
	}
}
