import {
	MOBILE_BUILD_SCOPE,
	offeredMobileBuild,
} from "@acme/utils/mobile-build";
import { z } from "zod";
import { readMobileBuild } from "../../services/mobile-build";
import { createTRPCRouter, publicProcedure } from "../init";

export const mobileBuildRoutes = createTRPCRouter({
	check: publicProcedure
		.input(
			z.object({
				applicationId: z.string().max(150),
				platform: z.string().max(20),
				channel: z.string().max(30),
				buildNumber: z.number().int().min(1).max(2100000000),
			}),
		)
		.query(async ({ ctx, input }) => {
			if (
				input.applicationId !== MOBILE_BUILD_SCOPE.applicationId ||
				input.platform !== MOBILE_BUILD_SCOPE.platform ||
				input.channel !== MOBILE_BUILD_SCOPE.channel
			)
				return { build: null };
			return {
				build: offeredMobileBuild(await readMobileBuild(ctx.db), input),
			};
		}),
});
