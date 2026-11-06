import { useTRPC } from "@/trpc/client";
import {
	MOBILE_BUILD_SCOPE,
	type PublishedMobileBuild,
	offeredMobileBuild,
	parseBuildNumber,
	parsePublishedMobileBuild,
} from "@acme/utils/mobile-build";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, Linking, Platform } from "react-native";

let openingBuildLink = false;

export function installedNativeBuild() {
	if (
		Platform.OS !== "android" ||
		Application.applicationId !== MOBILE_BUILD_SCOPE.applicationId ||
		Updates.channel !== "preview"
	)
		return null;
	try {
		return {
			...MOBILE_BUILD_SCOPE,
			buildNumber: parseBuildNumber(Application.nativeBuildVersion),
		};
	} catch {
		return null;
	}
}

export function useNativeBuildUpdate(enabled = true) {
	const trpc = useTRPC();
	const client = useQueryClient();
	const installed = useMemo(installedNativeBuild, []);
	const [opening, setOpening] = useState(false);
	const [openError, setOpenError] = useState<string | null>(null);
	const options = useMemo(
		() =>
			trpc.mobileBuild.check.queryOptions(
				installed ?? { ...MOBILE_BUILD_SCOPE, buildNumber: 1 },
			),
		[installed, trpc],
	);
	const query = useQuery({
		...options,
		enabled: enabled && !!installed,
		staleTime: 5 * 60_000,
		gcTime: 10 * 60_000,
		retry: 1,
	});
	const validate = useCallback(
		(value: unknown): PublishedMobileBuild | null => {
			if (!installed || !value) return null;
			try {
				return offeredMobileBuild(parsePublishedMobileBuild(value), installed);
			} catch {
				return null;
			}
		},
		[installed],
	);
	const build = validate(query.data?.build);
	const check = useCallback(async () => {
		if (!installed) return null;
		const result = await client.fetchQuery({
			...options,
			staleTime: 0,
			retry: false,
		});
		return validate(result.build);
	}, [client, installed, options, validate]);
	useEffect(() => {
		if (!enabled || !installed) return;
		const listener = AppState.addEventListener("change", (state) => {
			if (state === "active")
				void client
					.fetchQuery({ ...options, staleTime: 5 * 60_000 })
					.catch(() => undefined);
		});
		return () => listener.remove();
	}, [client, enabled, installed, options]);
	const openDownload = useCallback(async () => {
		if (openingBuildLink || !build) return;
		openingBuildLink = true;
		setOpening(true);
		setOpenError(null);
		try {
			const fresh = await check();
			if (!fresh || fresh.revision !== build.revision)
				throw new Error(
					"This build is no longer available. Check for updates again.",
				);
			await Linking.openURL(fresh.artifactUrl);
		} catch (error) {
			setOpenError(
				error instanceof Error
					? error.message
					: "Could not open the download. Try again.",
			);
		} finally {
			openingBuildLink = false;
			setOpening(false);
		}
	}, [build, check]);
	return {
		installed,
		build,
		checking: query.isFetching,
		error:
			openError ??
			(query.isError
				? "Could not check new builds. Reconnect and try again."
				: null),
		check,
		openDownload,
		opening,
	};
}
