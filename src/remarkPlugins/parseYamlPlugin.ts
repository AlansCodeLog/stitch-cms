import { castType } from "@alanscodelog/utils"
import type { Plugin } from "unified"
import { type Node, visit } from "unist-util-visit"
import type { VFile } from "vfile"
import YAML from "yaml"


export const parseYamlPlugin: Plugin = () => (tree: any, vfile) => {
	visit(tree, "yaml", (node: Node & { value: string }) => {
		// no, bad yaml, no, let me have my precious tabzzz
		const value = node.value.replaceAll("\t", "  ")

		const parsed = YAML.parse(value)
		castType<VFile & { metadata: any }>(vfile)

		vfile.metadata = parsed
	})
}
