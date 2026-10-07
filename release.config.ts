// The same component release command used by GND, Halaalvest, and EwaTrade.
const team = "team_BV5rgKHJH4fMyFL1YfscZIZK";

export default {
	project: "alghurobaa",
	productionBranch: "main",
	previewBranch: "preview",
	remote: "origin",
	components: [
		{
			name: "database",
			paths: ["packages/db/src/schema/**", "packages/db/prisma.config.ts"],
			sharedPaths: false,
			beforePush: true,
			// No isolated Preview database exists yet; never push Production as Preview.
			environments: ["production"],
			deploy: { production: "bun run db:push" },
		},
		{
			name: "api",
			app: "apps/api",
			paths: ["scripts/build-api-vercel.mjs", "scripts/deploy-api.mjs", "scripts/release-source.mjs", "scripts/vercel-deployment-output.mjs", "scripts/provider-cli.mjs"],
			vercel: { team, projects: ["alghurobaa-api"] },
			deploy: {
				preview: "node scripts/deploy-api.mjs --preview --revision {sha}",
				production: "node scripts/deploy-api.mjs --production --revision {sha}",
			},
		},
		{
			name: "web",
			app: "apps/www",
			vercel: { team, projects: ["al-ghurobaa-media-t3"] },
		},
		{
			name: "jobs",
			app: "packages/jobs",
			environments: ["production"],
			deploy: { production: "bun run --cwd packages/jobs deploy" },
		},
		{
			name: "mobile-android",
			paths: [
				"scripts/eas-account-runner.ts",
				"scripts/release-source.mjs",
				".easignore",
			],
			expo: {
				appDir: "apps/expo-app",
				platforms: ["android"],
				login: "bun run eas:auth",
				easEnv: { EXPO_NO_DOTENV: "1" },
				update: {
					preview:
						"bun run eas:update --preview --platform android --expected-commit {sha}",
					production:
						"bun run eas:update --prod --platform android --expected-commit {sha}",
				},
				build: {
					preview:
						"bun run eas:build --preview --platform android --expected-commit {sha} --non-interactive",
					production:
						"bun run eas:build --prod --platform android --expected-commit {sha} --non-interactive",
				},
			},
		},
	],
};
