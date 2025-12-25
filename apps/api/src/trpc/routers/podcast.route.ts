import z from "zod";
import { createTRPCRouter, publicProcedure } from "../init";
import { posts, postsSchema } from "@api/queries/posts";

export const postcastRoutes = createTRPCRouter({
  posts: publicProcedure.input(postsSchema).query(async (props) => {
    return posts(props.ctx, props.input);
  }),
});
