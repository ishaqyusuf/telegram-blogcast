import { router, type Router } from "expo-router";

export const _router = router;
export const _goBack: Router["back"] = (...args) => router.back(...args);
export const _push: Router["push"] = (...args) => router.push(...args);
export const _replace: Router["replace"] = (...args) => router.replace(...args);
export const _setRouteParams: Router["setParams"] = (...args) =>
  router.setParams(...args);

export function StaticRouter() {
  return null; // nothing to render
}
// export {
//   dehydrate,
//   useMutation,
//   useQueryClient,
//   MutationCache,
//   QueryClient,
//   defaultShouldDehydrateQuery,
//   useQuery,
//   // useSuspenseInfiniteQuery,
//   // useSuspenseQuery,
// } from "@tanstack/react-query";
