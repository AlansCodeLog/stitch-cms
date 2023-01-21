import { type Logger, pino } from "pino"
// TODO customize pino formatting
// 		format(info => {
// 			/** Log any extra properties as pretty json. */
// 			if (!filter(info)) return false
// 			const extra = omit(info, ["level", "message", "service"])
//
// 			if (extra.error !== undefined) {
// 				const error = extra.error
// 				extra.error = { message: error.message, stack: error.stack, ...error }
// 			}
//
// 			if (Object.keys(extra).length > 0) {
// 				const prettyExtra = yaml.stringify(extra).replace(/(^\s\s)/gm, "\t")
//
// 				info.message = `${info.message}\n${indent(prettyExtra, 1, { first: true })}`
// 			}
// 			// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
// 			info.message = `${colors.cyan + info.service + colors.reset} : ${info.message}`
// 			return info
// 		})(),
// 		format.colorize(),
// 		// format.timestamp(),
// 		format.errors({ stack: true }),
// 		format.align(),
// 		format.printf(info => `${info.level}: ${info.message}`),

const options = {
	transport: {
		targets: [
			{
				target: "pino-pretty",
				level: "trace", // both set to lowest otherwise they interfere with eachother ??????
				options: {
					colorize: true,
				},
			},
			// TODO define in index and pass down instead of export from here so we can set this from the index
			// {
			// 	level: "trace",
			// 	target: "pino/file",
			// 	options: { destination: "server.log" },
			// },
		],
	},
	customLevels: {
		verbose: 25,
	},
}
const _logger = pino(options)
// the types don't make it easy to type custom levels, these are worse types but less annoying
type CustomLogger = Logger & { verbose: (obj: any, msg?: string, ...args: any[]) => void }
export const logger = _logger as CustomLogger

const _remarkPluginsLogger = logger.child({ name: "remarkPlugins" })
export const remarkPluginsLogger = _remarkPluginsLogger as CustomLogger

const _imageHandlerLogger = logger.child({ name: "imageHandlerLogger" })
export const imageHandlerLogger = _imageHandlerLogger as CustomLogger

const _markdownHandlerLogger = logger.child({ name: "markdownHandler" })
export const markdownHandlerLogger = _markdownHandlerLogger as CustomLogger
