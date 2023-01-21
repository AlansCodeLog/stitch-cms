import { castType, get, isArray, isPrimitive, keys } from "@alanscodelog/utils"
import { type ServerInfo, ApolloServer } from "apollo-server"
import { type ValueNode, GraphQLScalarType, Kind } from "graphql"
import type { ContentHandler } from "index.js"
import path from "path"

import { DataApi } from "./datasources/dataApi.js"
import { DummyDb } from "./datasources/dummyDB.js"
import type { Filter, InputMaybe, QueryEntriesArgs, QueryRoutesInfoArgs, Resolvers } from "./generated/index.js"
import { logger } from "./logger.js"
import { typeDefs } from "./schema.js"
import type { AppContext, ContentFilter, RoutesInfo } from "./types.js"


export { ImageHandler } from "./plugins/ImageHandler.js"
export { MarkdownHandler } from "./plugins/MarkdownHandler.js"
export type { ContentHandler } from "ContentHandler.js"
export type { ContentEntry } from "./types.js"

export class StitchServer {
	private readonly dummyDb: DummyDb
	private readonly resolvers: Resolvers
	private readonly server?: ApolloServer
	port: number
	constructor({
		plugins,
		logLevel = "info",
		cache = true,
		cachePath = path.resolve(process.cwd(), "./.cache.json"),
		ignore = [],
		port = 4000,
	}: {
		/** A list of plugins/handlers, see {@link ContentHandler} */
		plugins: ContentHandler[]
		/** Set the log level. */
		logLevel?: "debug" | "verbose" | "info" | "warn" | "error" | "silent"
		/** Global cache option. Overrides plugin's cache option. */
		cache?: boolean
		/** By default the cache is writte to `./.cache.json` */
		cachePath?: string
		/** A list of globs to ignore. Will always include .git and node_modules. */
		ignore?: string[]
		/** The port for the apollo server. */
		port?: StitchServer["port"]
	}) {
		logger.level = logLevel
		this.port = port
		this.dummyDb = new DummyDb({
			plugins,
			cache,
			cachePath,
			ignore,
		})
		this.resolvers = {
			Query: {
				entries: async (_: any, args: Partial<QueryEntriesArgs>, { dataSources }: AppContext) => {
					const filter = this.entriesFilter(args.input?.filter)
					const existsFilter = this.entriesExistsFilter(args.input?.exists)
					const matchesFilter = this.entriesMatchesFilter(args.input?.matches)
					const entries = await dataSources.dataApi.getEntries([filter, existsFilter, matchesFilter])

					const offset = args.input?.offset ?? 0
					const limit = args.input?.limit ?? entries.length
					const res = entries.slice(offset * limit, (offset * limit) + limit)
					logger.verbose({ input: args.input, res: res.length }, `Received request for entries.`)
					return res
				},
				routesInfo: async (_: any, args: Partial<QueryRoutesInfoArgs>, { dataSources }: AppContext): Promise<RoutesInfo> => {
					const filter = this.entriesFilter(args.input?.filter)
					const existsFilter = this.entriesExistsFilter(args.input?.exists)
					const matchesFilter = this.entriesMatchesFilter(args.input?.matches)
					const res = await dataSources.dataApi.getRoutesInfo([filter, existsFilter, matchesFilter])
					logger.verbose({ input: args.input, res }, `Received request for routesInfo.`,)
					return res
				},
				serverReady: async (_: any, __: any, { dataSources }: AppContext) => {
					const res = await dataSources.dataApi.getServerReady()
					logger.verbose({ res }, `App requested server ready. DB is ${this.dummyDb.isReady ? "ready" : "not ready"}.`,)
					return res
				},
			},
			Date: new GraphQLScalarType<Date | null, string>({
				name: "Date",
				parseValue(value: unknown): Date {
					return new Date(value as number)
				},
				serialize(value: unknown): string {
					return (value as Date).toISOString()
				},
				parseLiteral(ast: ValueNode): Date | null {
					if (ast.kind === Kind.STRING) {
						return new Date(ast.value)
					}
					return null
				},
			}),
			Object: new GraphQLScalarType<Record<string, any> | null, string>({
				name: "Object",
				parseValue(value: unknown): Record<string, any> {
					try {
						return JSON.parse(value as string)
					} catch (error) {
						logger.error(`Error parsing ${value as string} as query Object scalar type.`, { error })
					}
					return {}
				},
				serialize(value: unknown): string {
					try {
						return JSON.stringify(value as string)
					} catch (error) {
						logger.error(`Error stringifying ${value as string} as query Object scalar type.`, { error })
						throw error
					}
				},
				parseLiteral(ast: ValueNode): Record<string, any> | null {
					if (ast.kind === Kind.STRING) {
						return JSON.parse(ast.value)
					}
					return null
				},
			}),
		}
	}
	/**
	 * Starts the database scanning and processing files.
	 *
	 * Does not need to be awaited before starting the server since the server will check it's ready before processing requests.
	 */
	async init(): Promise<void> {
		await this.dummyDb.init()
	}
	/** Start the apollo graphql server. */
	async start(): Promise<ServerInfo> {
		// @ts-expect-error codegen requires AppContext?
		this.server = new ApolloServer<AppContext>({
			typeDefs,
			dataSources: () => ({
				dataApi: new DataApi<AppContext>(this.dummyDb),
			}),
			resolvers: this.resolvers,
			onError: (error: Error) => { logger.error("Apollo Server Error", { error }) },
			logger: console,
		})
		let serverInfo
		try {
			serverInfo = await this.server.listen(this.port)
				.catch(error => {
					logger.error("Apollo Server Error", { error })
					process.exit(1)
				})
		} catch (error) {
			logger.error("Apollo Server Error", { error })
			process.exit(1)
		}

		logger.info(`
			🚀  Server is running! Query at ${serverInfo.url}
		`)
		return serverInfo
	}
	/** Creates a filter which will filter entries based on their main properties to be equal to or *contain* (in the case of arrays) the filter properties passed.*/
	entriesFilter(filter: InputMaybe<Filter> | undefined): ContentFilter {
		return entry => {
			if (filter) {
				for (const prop of keys(filter)) {
					if (isPrimitive(filter[prop]) && entry[prop] !== filter[prop]) { return false }
					if (isArray(filter[prop])) {
						if (!isArray(entry[prop])) return false
						castType<Record<typeof prop, string[]>>(entry)
						castType<Record<typeof prop, string[]>>(filter)
						for (const item of filter[prop]) {
							if (!entry[prop].includes(item)) return false
						}
						return true
					}
				}
			}
			return true
		}
	}
	/** Creates a filter which will filter entries to at least have the property passed defined. */
	entriesExistsFilter(exists: InputMaybe<string[]> | undefined): ContentFilter {
		return post => {
			if (exists) {
				for (const keyPath of exists) {
					const value = get(post, keyPath.split("."))
					if (value === undefined) return false
				}
			}
			return true
		}
	}
	/**
	 * Similar to entriesFilter but value must be an exact match. And the property can be any property, not just known properties.
	 *
	 * Should be passed to the server in the form:
	 *
	 * ```ts
	 * "extra.some.prop" : true
	 * ```
	 */
	entriesMatchesFilter(matches: InputMaybe<Record<string, any>> | undefined): ContentFilter {
		return post => {
			if (matches) {
				for (const [keyPath, valueToMatch] of Object.entries(matches)) {
					const value = get(post, keyPath.split("."))
					if (value !== valueToMatch) return false
				}
			}
			return true
		}
	}
}

