export type Transformer = { name: string, include?: string[], regex?: RegExp, custom?: (url: string) => string }

export const transformers: Transformer[] = [
	{
		name: "instagram",
		regex: /https?:\/\/www.instagram.com\/([a-z]|[A-Z]|[0-9])+/,
	},
	{
		name: "imgur",
		include: ["http://imgur.com/gallery"],
	},
	{
		name: "twitter",
		include: ["https://twitter.com/"],
	},
	{
		name: "github",
		include: ["https://gist.github.com/"],
	},
	// TODO github support, maybe https://emgithub.com/
	{
		name: "youtube",
		include: ["https://www.youtube.com/watch?v=", "https://youtu.be/", "https://www.youtube.com/shorts/"],
		custom: (url: string) => {
			const id = url.replace(/.*?(youtube\.com|youtu\.be)\/(embed\/|shorts\/|watch\?v=)?(.*)/, "$3")
			return `
				<span class="lazy-youtube" data-src="https://www.youtube.com/embed/${id}?autoplay=1" style="background-image:url(https://img.youtube.com/vi/${id}/hqdefault.jpg)">
					<button aria-label="video play"></button>
				</span>
			`
		},
	},
	{
		name: "gist",
		include: ["https://gist.github.com/"],
	},
]
