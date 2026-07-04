import {
	checkFacebookMediaBridge,
	checkFacebookMediaBridgeSchema,
	clearFailedFacebookMediaImportStatuses,
	facebookMediaImportSummarySchema,
	getFacebookMediaImportChannels,
	getFacebookMediaImportJob,
	getFacebookMediaImportSummary,
	listFacebookMediaImports,
	listFacebookMediaImportsSchema,
	startFacebookMediaImportJob,
	startFacebookMediaImportSchema,
	stopFacebookMediaImportJob,
} from "../../services/facebook-media-import";
import { createTRPCRouter, publicProcedure } from "../init";

export const facebookImportRoutes = createTRPCRouter({
	getSummary: publicProcedure
		.input(facebookMediaImportSummarySchema)
		.query(async ({ ctx, input }) => {
			return getFacebookMediaImportSummary(ctx.db, input);
		}),

	getChannels: publicProcedure.query(async ({ ctx }) => {
		return getFacebookMediaImportChannels(ctx.db);
	}),

	listMediaImports: publicProcedure
		.input(listFacebookMediaImportsSchema)
		.query(async ({ ctx, input }) => {
			return listFacebookMediaImports(ctx.db, input);
		}),

	getMediaImportJob: publicProcedure.query(() => {
		return getFacebookMediaImportJob();
	}),

	startMediaImport: publicProcedure
		.input(startFacebookMediaImportSchema)
		.mutation(async ({ ctx, input }) => {
			return startFacebookMediaImportJob(ctx.db, input);
		}),

	stopMediaImport: publicProcedure.mutation(() => {
		return stopFacebookMediaImportJob();
	}),

	clearFailedMediaImports: publicProcedure
		.input(facebookMediaImportSummarySchema)
		.mutation(async ({ ctx, input }) => {
			return clearFailedFacebookMediaImportStatuses(ctx.db, input);
		}),

	checkBridge: publicProcedure
		.input(checkFacebookMediaBridgeSchema)
		.query(async ({ input }) => {
			return checkFacebookMediaBridge(input);
		}),
});
