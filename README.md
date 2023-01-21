# Stitch CMS
🚧 WIP 🚧

![Build](https://github.com/alanscodelog/stitch-cms/workflows/Build/badge.svg)
<!-- [![Release](https://github.com/alanscodelog/stitch-cms/workflows/Release/badge.svg)](https://www.npmjs.com/package/stitch-cms) -->

A tiny custom headless CMS that reads files scattered across any number of folders, resolves/"stitches" their links to each other, compiles them to html, then serves them using graphql for consuming however you like.

# [Docs](http://alanscodelog.github.io/stitch-cms)

# Install

```bash
npm install https://github.com/alanscodelog/stitch-cms
```

# Usage

```ts
import path from "path"

import { StitchServer, ImageHandler, MarkdownHandler } from "stitch-cms"

/**
 * With a structure that looks like this:
 * root:
 * 	- client
 * 		- public
 * 	- data
 * 		- ...markdown files
 * 		- uploads
 */

const root = "..."

const blog = new StitchServer({
	plugins: [
		new MarkdownHandler({
			globs: [`${path.resolve(root, "data")}/**/*.md`],
		}),
		new ImageHandler({
			globs: [`${path.resolve(root, "data/uploads")}/**/*`],
			outputPath: path.resolve(root, "client/public/resources"),
		}),
	],
})

// you can await the database initialization but it's not needed, the server will wait for it to finish before fulfilling requests
blog.init()
await blog.listen()

```

You can then query the server using graphql.

The schema is [here](https://github.com/AlansCodeLog/stitch-cms/blob/master/src/schema.ts), but you should use something like graphql-codegen to generate the types for using locally in your app automatically.


WIP Notes:

- The MarkdownHandler plugin is VERY opinionated and not very exposed for customization currently.
- All the custom remark plugins live in this repo for the moment.
- @extractus/oembed-extractor is used for embeds and requires API keys for certain embeds. The server will warn if something couldn't be transformed.

# [Example](https://github.com/AlansCodeLog/stitch-cms/blob/master/test.ts)

# Why?

Well I wanted a static site generator that had the following:

- Compatibility with arbitrary markdown files. That is, they are not tied to the blog and do not have generator specific frontmatter properties (like layout). Building on an old metalsmith-plugin I made, I believe the organization of the data is kept as seperate from the data as possible.
- Markdown files can be anywhere. I can keep them in an obsidian vault or somewhere else, many places can be scanned.
- Resolution of wiki/obsidian like links.
- Hot-ish reloading, i.e. reloading without a complete rebuild of the entire site.
	- Since reloading will refetch the content from the server which keeps it updated, it will be updated with a refresh. Real hot reloading could theoretically be implemented but is a bit more complicated.
- Speed.
	- Processing my art blog (~80 posts, and ~200 images) takes less than 10s and after that any edits are automatically detected and processed.
	- I've built in some caching just in case, but there's currently not enough volume of posts for it to make a difference.

Also it was a nice chance to ~~abuse~~ learn graphql.

## How it Works

First a dummy database is created and hooked up to the apollo server.

This dummy databases takes in plugins which define what globs to scan for and what files they have control over. Two plugins (one for images and one for markdown) are provided.

Two plugins should not handle globs that have interesecting files. There are guards against this.

Aditionally no files can have the same id. A file's id is used to uniquely identify it and also be able to globally link to it using wiki/obsidian like links.

Plugins will usually need to define four simple methods:

- parse
- compile
- resolve
- unresolve

When the database loads it starts chokidar watching the file globs. There's some magic happening to keep track of which plugin has control over what file (two plugins cannot control the same file).

When a file is added, it's handler plugin is called to parse it.

After it's parsed we know it's id, permalink (the plugin is in charge of defining how it's defined) and other necessary properties to be able resolve links to it by other files. We also get a list of links it's searching for. The parser should return these as absolute links or "global" links (the internal part of a wiki/obsidian link). It should not return urls. The plugin should keep the parsed tree (or trees, it's up to the plugin completely) somewhere in the ContentEntry.file property where it can store whatever it wants.

The dummy database then takes care of searching other entries that can resolve the links and calls the plugin with the necessary info to resolve them. It also does the reverse for other entries which link to that entry, and takes care of updating the `linkedBy` property for all entries.

Afterwards it asks the plugin to compile the entry so that the final output html and metadata is available.

This makes it possible for plugins to resume compiling from the already parsed/transformed tree without reparsing each time. Aditionally there is a cache functionality they can use to at least skip the initial parse step. The compile step cannot be easily cached because of the possibly constantly changing links.

Optionally a plugin, like those that handle images, can choose not to compile or return anything, and instead move the images to the right location in the client. Plugins can also choose to parse not just one property but multiple properties if needed. For example, I make the markdown plugin also parse thumbnail captions.

For parsing, remark has been used with some custom plugins to:

- Resolve embeds (unrelated to this, just needed for my blog).
- Parse wiki/obsidian links, including image links.
- Extract the first heading to use as the title.
- Parse the yaml header.
- Transform links (to resolve/unresolve them).
	- This can also set additional properties, which plugins are allowed to specify. So the image plugin will ask that set `srcset` and `sizes` on any links to images it handles.
- Resolve and extract non-url links to give them back to the dummy DB.
- Highlight code block with prismjs (I found remark-prism to be unbearably slow, increasing parse times to 1s or more per document).
- Transform images to figure elements with captions (using the markdown title) and alt text.

The only downside about all this is apollo only works with fixed schemas. Allowing the configuration of these seems difficult. Extra properties must all be thrown in one object and left up to the client to parse. Also the client must parse the date property upon receiving.


