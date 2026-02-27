import z from "zod";
import { createTRPCRouter, publicProcedure } from "../init";
import { posts, postsSchema } from "@api/queries/posts";
import { consoleLog } from "@acme/utils";

export const postcastRoutes = createTRPCRouter({
  posts: publicProcedure.input(postsSchema).query(async (props) => {
    consoleLog("Fetching posts with input:", props.input);
    return posts(props.ctx, props.input);
  }),
});
