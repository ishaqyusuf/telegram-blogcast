import { parseAsString, useQueryStates } from "nuqs";
import { createLoader } from "nuqs/server";

export type BlogFilterType = "all" | "text" | "image" | "audio";

export function normalizeBlogFilterType(
    value: string | null | undefined,
): BlogFilterType {
    if (value === "text" || value === "image" || value === "audio") {
        return value;
    }
    return "all";
}

export const blogFilterParamsSchema = {
    q: parseAsString,
    type: parseAsString,
};

export function useBlogFilterParams() {
    const [filters, setFilters] = useQueryStates(blogFilterParamsSchema);
    const normalizedType = normalizeBlogFilterType(filters.type);

    return {
        filters: {
            q: filters.q ?? "",
            type: normalizedType,
        },
        hasFilters: Boolean(filters.q) || normalizedType !== "all",
        setFilters,
    };
}

export const loadBlogFilterParams = createLoader(blogFilterParamsSchema);
