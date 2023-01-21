import dotenv from "dotenv"
import path from "path"

import { ImageHandler, MarkdownHandler, StitchServer } from "./src/index.js"

// read env variables (for @extractus/oembed-extractor)
dotenv.config()

/**
 * Example/Test File
 *
 * My structure looks like:
 * root:
 * 	- client
 * 		- public
 * 	- data
 * 		- markdown
 * 		- uploads
 */

const root = path.resolve(process.env.BLOG_DIR ?? "../")

const blog = new StitchServer({
	plugins: [
		new MarkdownHandler({
			globs: [`${path.resolve(root, "data")}/**/*.md`],
			permalink: (name, _ext, metadata) => {
				let base = "/"
				switch (metadata.type) {
					case "post": {
						const year = (metadata.date as Date).getFullYear().toString().padStart(2, "0")
						const month = ((metadata.date as Date).getMonth() + 1).toString().padStart(2, "0")
						base = `/${year}/${month}/`
						break
					}
				}
				// for other non-post pages, just return `/{PAGENAME}`
				return base + name
			},
			cache: process.env.NODE_ENV === "PRODUCTION", // i use this file for testing
		}),
		new ImageHandler({
			globs: [`${path.resolve(root, "data/uploads")}/**/*.{jpeg,jpg,png,mp4,gif}`],
			outputPath: path.resolve(root, "client/public/resources"),
			permalink: "/resources/",
		}),
	],
})


await blog.start()
