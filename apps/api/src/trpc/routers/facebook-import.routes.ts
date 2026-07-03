import {
	checkFacebookMediaBridge,
	checkFacebookMediaBridgeSchema,
	getFacebookMediaImportJob,
	getFacebookMediaImportSummary,
	listFacebookMediaImports,
	listFacebookMediaImportsSchema,
	startFacebookMediaImportJob,
	startFacebookMediaImportSchema,
} from "../../services/facebook-media-import";
import { createTRPCRouter, publicProcedure } from "../init";

export const facebookImportRoutes = createTRPCRouter({
	getSummary: publicProcedure.query(async ({ ctx }) => {
		return getFacebookMediaImportSummary(ctx.db);
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

	checkBridge: publicProcedure
		.input(checkFacebookMediaBridgeSchema)
		.query(async ({ input }) => {
			return checkFacebookMediaBridge(input);
		}),
});
