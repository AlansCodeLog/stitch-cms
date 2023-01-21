import { gql } from "apollo-server"


export const typeDefs = gql`
	scalar Date
	scalar Object

	input Filter {
		title: String
		content: String
		filepath: String
		publish: Boolean
		permalink: String
		slug: String
		tags: [String!]
		type: String
		date: Date
	}

	input QueryInput {
		filter: Filter
		exists: [String!]
		matches: Object
		limit: Int
		offset: Int
	}
	type Query {
		entries (input: QueryInput): [Entry!]
		routesInfo (input: QueryInput): Routes!
		serverReady: Boolean!
	}
	type Entry {
		title: String!
		content: String
		filepath: String!
		publish: Boolean!
		permalink: String!
		slug: String!
		tags: [String!]!
		type: String!
		date: Date!
		extra: Object!
	}
	type TagInfo {
		name: String!
		slug: String!
		count: Int!
	}
	type Routes {
		tags: [TagInfo!]!
		count: Int
	}
`
