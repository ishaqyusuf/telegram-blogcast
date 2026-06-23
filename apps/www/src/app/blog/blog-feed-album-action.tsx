"use client";

import { useMutation, useQuery, useQueryClient } from "@acme/ui/tanstack";
import { Check, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";

type BlogFeedAlbumActionProps = {
    mediaId: number;
};

function getAlbumInitials(name?: string | null) {
    if (!name) return "AL";

    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");
}

export function BlogFeedAlbumAction({ mediaId }: BlogFeedAlbumActionProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [newAlbumName, setNewAlbumName] = useState("");

    const { data: albums = [], isLoading } = useQuery(
        trpc.album.getAlbums.queryOptions(),
    );

    const addMedia = useMutation(
        trpc.album.addMediaToAlbum.mutationOptions({
            onSuccess: () => {
                void queryClient.invalidateQueries(
                    trpc.album.getAlbums.queryOptions(),
                );
                setOpen(false);
                setNewAlbumName("");
                router.refresh();
            },
        }),
    );

    const createAlbum = useMutation(
        trpc.album.createAlbum.mutationOptions({
            onSuccess: (album) => {
                addMedia.mutate({ albumId: album.id, mediaIds: [mediaId] });
            },
        }),
    );

    const isBusy = addMedia.isPending || createAlbum.isPending;
    const errorMessage =
        addMedia.error?.message ?? createAlbum.error?.message ?? null;

    return (
        <div className="relative">
            <button
                type="button"
                aria-label="Add to album"
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen((value) => !value);
                }}
                className="inline-flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/15"
            >
                <Plus size={14} />
            </button>

            {open ? (
                <div
                    className="absolute bottom-9 left-0 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl"
                    onClick={(event) => {
                        event.stopPropagation();
                    }}
                >
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">Add to album</p>
                        <button
                            type="button"
                            aria-label="Close"
                            onClick={() => setOpen(false)}
                            className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                            <X size={15} />
                        </button>
                    </div>

                    <div className="mb-3 flex gap-2">
                        <input
                            value={newAlbumName}
                            onChange={(event) =>
                                setNewAlbumName(event.target.value)
                            }
                            placeholder="New album name..."
                            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-muted/45 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none"
                        />
                        <button
                            type="button"
                            disabled={!newAlbumName.trim() || isBusy}
                            onClick={() => {
                                const name = newAlbumName.trim();
                                if (!name) return;
                                createAlbum.mutate({ name });
                            }}
                            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity disabled:opacity-45"
                        >
                            {createAlbum.isPending ? (
                                <Loader2 size={15} className="animate-spin" />
                            ) : (
                                "Create"
                            )}
                        </button>
                    </div>

                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Existing albums
                    </p>

                    <div className="max-h-56 space-y-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-5 text-muted-foreground">
                                <Loader2 size={18} className="animate-spin" />
                            </div>
                        ) : albums.length === 0 ? (
                            <p className="py-4 text-center text-sm text-muted-foreground">
                                No albums yet.
                            </p>
                        ) : (
                            albums.map((album) => (
                                <button
                                    key={album.id}
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => {
                                        addMedia.mutate({
                                            albumId: album.id,
                                            mediaIds: [mediaId],
                                        });
                                    }}
                                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted disabled:opacity-55"
                                >
                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                                        {getAlbumInitials(album.name)}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium">
                                            {album.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {album._count?.medias ?? 0} tracks
                                        </span>
                                    </span>
                                    {addMedia.isPending ? (
                                        <Loader2
                                            size={15}
                                            className="animate-spin text-muted-foreground"
                                        />
                                    ) : (
                                        <Check
                                            size={15}
                                            className="text-muted-foreground"
                                        />
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    {errorMessage ? (
                        <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                            {errorMessage}
                        </p>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
