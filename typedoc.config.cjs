const fs = require("fs")
const path = require("path")
const pkg = require("./package.json")


module.exports = {
	githubPages: true,
	navigationLinks: {
		"Github": pkg.repository,
		"Issues": pkg.repository + "/issues",
		"npm": "http://npmjs.com/" + pkg.name,
	},
	readme: "README.md",
	logLevel: "Verbose",
	entryPoints: "src/index.ts",
	out: "docs",
	excludePrivate: true,
	excludeExternals: true,
	// // temporarily turn off plugins (just setting plugin: [] will not work)
	// plugin: "none",
	validation: {
		invalidLink: true,
	},
}
