import { DataSource } from "apollo-datasource"
import { InMemoryLRUCache } from "apollo-server-caching"

import type { DummyDb } from "./dummyDB.js"

import type { Entry } from "../generated/index.js"
import type { ContentFilter, RoutesInfo } from "../types.js"


export class DataApi<TContext> extends DataSource<TContext> {
	protected context: TContext = undefined as TContext
	private cache!: InMemoryLRUCache
	dummyDb: DummyDb
	constructor(dummyDb: DummyDb) {
		super()
		this.dummyDb = dummyDb
	}
	initialize({ context, cache }: { context?: TContext, cache?: any } = {}): void {
		this.context = context as TContext
		this.cache = cache || new InMemoryLRUCache()
	}
	async getEntries(filters: ContentFilter[]): Promise<Entry[]> {
		return this.dummyDb.getEntries(filters)
	}
	async getServerReady(): Promise<boolean> {
		return this.dummyDb.getReady()
	}
	async getRoutesInfo(filters: ContentFilter[]): Promise<RoutesInfo> {
		return this.dummyDb.getRoutesInfo(filters)
	}
}
