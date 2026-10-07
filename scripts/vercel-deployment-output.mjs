export function deploymentUrlFromOutput(output) {
	const deployment = JSON.parse(output.trim());
	if (
		deployment.readyState !== "READY" ||
		typeof deployment.url !== "string" ||
		!/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(deployment.url)
	) {
		throw new Error("Vercel did not return a Ready deployment URL.");
	}
	return deployment.url;
}
