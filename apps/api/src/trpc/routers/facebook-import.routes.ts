import { isLocalGatewayRequestHost } from "@acme/utils/local-gateway-discovery";
import { TRPCError } from "@trpc/server";
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
import {
	getFacebookSavedSyncState,
	syncFacebookSavedCapture,
	syncFacebookSavedCaptureSchema,
} from "../../services/facebook-saved-sync";
import { createTRPCRouter, publicProcedure } from "../init";

const facebookSavedSyncProcedure = publicProcedure.use(({ ctx, next }) => {
	if (!isLocalGatewayRequestHost(ctx.requestHost)) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message:
				"Facebook saved-post sync is available only through local services.",
		});
	}
	return next({ ctx });
});

export const facebookImportRoutes = createTRPCRouter({
	getSavedSyncState: facebookSavedSyncProcedure.query(() => {
		return getFacebookSavedSyncState();
	}),

	syncSavedPosts: facebookSavedSyncProcedure
		.input(syncFacebookSavedCaptureSchema)
		.mutation(({ ctx, input }) => {
			return syncFacebookSavedCapture(ctx.db, input);
		}),

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

	getMediaImportJob: publicProcedure.query(({ ctx }) => {
		return getFacebookMediaImportJob(ctx.db);
	}),

	startMediaImport: publicProcedure
		.input(startFacebookMediaImportSchema)
		.mutation(async ({ ctx, input }) => {
			return startFacebookMediaImportJob(ctx.db, input);
		}),

	stopMediaImport: publicProcedure.mutation(({ ctx }) => {
		return stopFacebookMediaImportJob(ctx.db);
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
