import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import { createTRPCRouter } from "../init";
import { albumRoutes } from "./album.routes";
import { blogRoutes } from "./blog.routes";
import { bookRoutes } from "./book.routes";
import { channelRoutes } from "./channel.route";
import { facebookImportRoutes } from "./facebook-import.routes";
import { libraryRoutes } from "./library.routes";
import { playlistRoutes } from "./playlist.routes";
import { postcastRoutes } from "./podcast.route";

export const appRouter = createTRPCRouter({
	podcasts: postcastRoutes,
	channel: channelRoutes,
	blog: blogRoutes,
	album: albumRoutes,
	facebookImport: facebookImportRoutes,
	playlist: playlistRoutes,
	book: bookRoutes,
	library: libraryRoutes,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
