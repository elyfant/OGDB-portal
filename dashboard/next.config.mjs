/** @type {import('next').NextConfig} */
const nextConfig = {
	// The RMAs pages moved to /orders when that section was renamed --
	// these keep old bookmarks and shared links working. Only the page
	// routes moved: the /api/rmas proxy routes (and the gateway's /rmas
	// endpoints behind them) keep their names, so they're not listed.
	async redirects() {
		return [
			{ source: "/rmas", destination: "/orders", permanent: true },
			{ source: "/rmas/:id", destination: "/orders/:id", permanent: true },
		];
	},
};

export default nextConfig;
