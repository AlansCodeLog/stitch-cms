/* eslint-disable @typescript-eslint/no-empty-function */

import { type MakeOptional, keys } from "@alanscodelog/utils"
import type fs from "fs"

import type { ContentEntry, ContentMetadata, InternalContentEntry, LinkMapperResolve, LinkMapperUnResolve } from "./types.js"


export class ContentHandler<TParsed = any> {
	globs: string[]
	name: string
	/**
	 * The cache should be an object and it should not be re-assigned to (i.e. do no do `this.cache = ...` after constructing) or the server will loose track of it and will not write/load it from disk.
	 */
	cache: any
	cacheEnabled?: boolean = true
	constructor(
		/** The plugin name. */
		name: ContentHandler["name"],
		/** A list of globs it handles. */
		globs: ContentHandler<TParsed>["globs"]
	) {
		this.globs = globs
		this.name = name
	}
	createMetadata(metadata: Omit<MakeOptional<ContentMetadata, "publish" | "tags">, "extra"> & Record<string, any>): ContentMetadata {
		const mainMetadata = {
			title: metadata.title,
			type: metadata.type,
			filepath: metadata.filepath,
			slug: metadata.slug,
			publish: metadata.publish ?? false,
			tags: metadata.tags ?? [],
			permalink: metadata.permalink,
			date: metadata.date ?? new Date(-8640000000000000),
			extra: { ...(metadata.extra ?? {}) } as Record<string, any>,
		}
		for (const key of keys<string>(metadata)) {
			if (!(key in mainMetadata)) {
				mainMetadata.extra[key] = metadata[key]
			}
		}
		return mainMetadata
	}
	async onCacheLoad(): Promise<void> {
	}
	/**
	 * Should do the initial entry parsing and partially "resolve" any relative paths and wiki/obsidian like paths.
	 *
	 * See {@link ContentEntry} for what it needs to return.
	 *
	 * It should also keep a reference to the parsed tree if there is any, such that it can be changed to resolve/unresolve links and get recompiled without reparsing it.
	 */
	async parse(filepath: string, stats?: fs.Stats): Promise<ContentEntry<TParsed>>
	async parse(_filepath: string, _stats?: fs.Stats): Promise<ContentEntry<TParsed>> {
		throw new Error(`You must write a parse method for plugin ${this.name}`)
	}
	/**
	 * Should do any final compilation steps. The server will call it as needed. Some files might not need compilation, it is not required.
	 */
	async compile(entry: InternalContentEntry<TParsed>): Promise<ContentEntry<TParsed>>
	async compile(_entry: InternalContentEntry<TParsed>): Promise<ContentEntry<TParsed>> {
		throw new Error(`You must write a parse method for plugin ${this.name}`)
	}
	/**
	 * Given an entry and a link map (Record<link, {id, permalink}>), should return a list of ids it could resolve if it is a type of file that can resolve them.
	 *
	 * The default implementation returns an empty array.
	 */
	async resolve(entry: InternalContentEntry<TParsed>, linkMap: LinkMapperResolve): Promise<string[]>
	async resolve(_entry: InternalContentEntry<TParsed>, _linkMap: LinkMapperResolve): Promise<string[]> {
		return []
	}
	/**
	 * Given an entry and a link map (Record<permalink, {id, link}>), should return a list of ids it could unresolve (change back from permalinks to link, the original resolved path) if it is a type of file that can resolve links.
	 *
	 * The default implementation returns an empty array.
	 */
	async unresolve(entry: InternalContentEntry<TParsed>, linkMap: LinkMapperUnResolve): Promise<string[]>
	async unresolve(_entry: InternalContentEntry<TParsed>, _linkMap: LinkMapperUnResolve): Promise<string[]> {
		return []
	}
	async onDelete(entry: InternalContentEntry<TParsed>): Promise<any>
	async onDelete(_entry: InternalContentEntry<TParsed>): Promise<any> {
		return undefined
	}
}
