import { unreachable } from "@alanscodelog/utils"
// import remarkPresetLintRecommended from "remark-preset-lint-recommended"
import crypto from "crypto"
import fsSync, { type Stats } from "fs"
import fs from "fs/promises"
import path from "path"
import sharp from "sharp"

import { ContentHandler } from "../ContentHandler.js"
import { imageHandlerLogger as logger } from "../logger.js"
import type { ContentEntry, InternalContentEntry } from "../types.js"
import { generateSafeSlug } from "../utils.js"


export type FileSizeInfo = {
	width: number
	height: number
	filename: string
	resizedFilepath: string
	permalink: string
	// buffer: Buffer
}
export type ContentFile = {
	sizes: FileSizeInfo[]
}

const catchError = (filename: string, fileoutpath: string) => (error: Error) => {
	logger.error(`Error writing ${filename} to ${fileoutpath}.`, { error })
	// console.log(error)
}

const extensionRegExp = /\.[^.]*?$/

// import remarkPresetLintRecommended from "remark-preset-lint-recommended"

export class ImageHandler<T extends ContentFile = ContentFile> extends ContentHandler<T> {
	private readonly permalink: string | ((slug: string, filepath: string) => string) = "/resources/"
	private readonly _sizeSuffix: ((width: number, height: number) => string) = width => `_${width}w`
	cache: { images: Record<string, ContentFile>, dirs: Record<string, true> } = { dirs: {}, images: {} }
	widths: number[] = [400, 700, 1000]
	type: string = "image"
	sizesProperty: string = `(min-width: 700px) 100vw, 700px`
	outputPath: string
	constructor(
		{	permalink, sizeSuffix, widths, outputPath, globs, cache }:
		{
			globs: string[]
			/** The type to set for files processed by this plugin. The default is image.*/
			type?: ImageHandler<T>["type"]
			/** The permalink base, e.g. `/resources/`, in which case the permalinks will look like `/resources/slug` or a function that returns the permalink. */
			permalink?: ImageHandler<T>["permalink"]
			/** The size suffix to add to resized files, the default is `_{WIDTH}w`*/
			sizeSuffix?: ImageHandler<T>["_sizeSuffix"]
			/**
			 * For setting the sizes property for use with srcset on images. Since what you want might vary, this is not automatically generated and should be changed depending on the layout.
			 *
			 * The default is 700px images at 700px or wider since that is what I limit my post widths to, otherwise the image is at nearly 100vw and the appropriate size should be chosen.
			 */
			sizesProperty?: ImageHandler<T>["sizesProperty"]
			/**
			 * A list of widths to resize to.
			 *
			 * If the image is smaller than the width specified it is NOT created and it will be copied WITHOUT a suffix.
			 *
			 * If the image is bigger than the largest width specified, the original will NOT be copied, and it will only exist suffixed.
			 *
			 * The default is  [400, 700, 1000] which I find are good sizes. 400 for mobile, 700 is the max post width, 1000 is for if the user wants to see a more high def picture.
			 */
			widths?: ImageHandler<T>["widths"]
			/** The output path. Note this is cleaned of unknown images. */
			outputPath: ImageHandler<T>["outputPath"]
			/** Whether to enable the cache. If an image is found in the cache that satisfies the necessary sizes, it will not be reprocessed/copied. */
			cache?: ImageHandler<T>["cacheEnabled"]
		}
	) {
		super("image plugin", globs)
		if (permalink) this.permalink = permalink
		if (sizeSuffix) this._sizeSuffix = sizeSuffix
		if (widths) this.widths = widths.sort((a, b) => a - b)

		if (cache !== undefined) this.cacheEnabled = cache
		this.outputPath = outputPath
	}

	override async onCacheLoad(): Promise<void> {
		await fs.rm(this.outputPath, { recursive: true, force: true })
		await fs.mkdir(this.outputPath)
		this.cache.dirs = {}
	}
	override async parse(filepath: string, stats?: Stats): Promise<ContentEntry<T>> {
		const { name, ext } = path.parse(filepath)

		if (!this.cache.dirs[this.outputPath] && !fsSync.existsSync(this.outputPath)) {
			logger.verbose(`Creating directory at ${this.outputPath}.`)
			fsSync.mkdirSync(this.outputPath, { recursive: true })
			this.cache.dirs[this.outputPath] = true
		}

		const file = sharp(filepath)
		const imageMetadata = await file.metadata()
		const title = `${name}${ext}`

		const slug = generateSafeSlug(title)
		const originalPermalink = this.getPermalink(slug, filepath)

		const hash = crypto.createHash("md5").update(filepath + (stats?.mtime ?? new Date()).toISOString()).digest("hex")

		const { width, height } = imageMetadata
		if (!width || !height) unreachable()

		let maxSizeCreated = false
		const maxSize = Math.max(...this.widths)
		const availableSizes = (await Promise.all(this.widths.map(async w => {
			if (width >= w) {
				if (w === maxSize) maxSizeCreated = true
				return this._createSize({ appendSize: w > maxSize, width: w, ratio: width / height, file, filepath, slug, ext, hash })
			} else if (!maxSizeCreated) {
				maxSizeCreated = true
				return this._createSize({ appendSize: false, width: w, ratio: width / height, file, filepath, slug, ext, hash })
			}
			return undefined
		}))).filter(resized => resized !== undefined) as FileSizeInfo[]


		const content: T = {
			sizes: availableSizes,
		} as any as T
		this.cache.images[hash] = content
		// }
		const properties = {
			srcset: content.sizes.map(size => `${size.permalink} ${size.width}w`).join(","),
			sizes: this.sizesProperty,
			load: "lazy",
		}
		let biggestSize: FileSizeInfo | undefined
		for (const size of content.sizes) {
			if (biggestSize === undefined || biggestSize.width < size.width) {
				biggestSize = size
			}
		}
		const metadata = this.createMetadata({
			slug,
			title,
			filepath,
			type: this.type,
			publish: true,
			permalink: biggestSize?.permalink ?? originalPermalink,
			date: stats?.ctime,
		})

		return { filepath, id: `${name}.${ext}`, metadata, permalink: metadata.permalink, properties, links: [], file: content, output: undefined }
	}
	getPermalink(slug: string, filepath: string): string {
		return typeof this.permalink === "function" ? this.permalink(slug, filepath) : `${this.permalink}${slug}`
	}
	private async _createSize(
		{ width, appendSize, file, ratio, filepath, slug, ext, hash }:
		{ width: number, appendSize: boolean, file: sharp.Sharp, filepath: string, slug: string, ext: string, ratio: number, hash: string }
	): Promise<FileSizeInfo> {
		if (this.cache.images[hash] && this.cacheEnabled) {
			const entry = this.cache.images[hash]
			const size = entry.sizes.find(s => s.width === width)
			if (size) {
				if (fsSync.existsSync(size.resizedFilepath)) {
					return size
				}
			}
		}
		const height = Math.floor(width * 1 / ratio)
		const extra = appendSize ? `${ext}` : `${this._sizeSuffix(width, height)}${ext}`
		const filename = `${slug.replace(extensionRegExp, "")}${extra}`
		const resizedFilepath = path.resolve(this.outputPath, filename)
		const permalink = this.getPermalink(filename, resizedFilepath)

		if (resizedFilepath === filepath) {
			throw new Error(`Output path should not be the same as input path: ${filepath}, output: ${resizedFilepath}`)
		}

		const clone = file.clone()
			.resize(width, null, { withoutEnlargement: true })

		// const buffer = await clone.toBuffer()
		await clone.toFile(resizedFilepath).catch(catchError(filepath, resizedFilepath))
		return { width, height, filename, resizedFilepath, permalink }
	}

	override async compile(entry: InternalContentEntry<T>): Promise<ContentEntry<T>> {
		return entry as ContentEntry<T>
	}

	override async onDelete(entry: InternalContentEntry<T>): Promise<any> {
		return Promise.all(entry.file.sizes.map(async size =>
			fs.unlink(size.resizedFilepath)
		))
	}
}
