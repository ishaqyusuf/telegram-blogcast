export function deploymentUrlFromOutput(output) {
	const payload = JSON.parse(output.trim());
	// Vercel wraps JSON in a deployment envelope when it detects an agent.
	const deployment = payload.deployment ?? payload;
	if (
		(payload.status && payload.status !== "ok") ||
		deployment.readyState !== "READY" ||
		typeof deployment.url !== "string" ||
		!/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(deployment.url)
	) {
		throw new Error("Vercel did not return a Ready deployment URL.");
	}
	return deployment.url;
}
