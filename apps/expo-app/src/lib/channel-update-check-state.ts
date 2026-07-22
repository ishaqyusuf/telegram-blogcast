import type { LocalServicesConnectionStatus } from "./local-services-session";

export type ChannelUpdateCheckState = {
	completedIps: readonly string[];
	inFlightIp: string | null;
};

export function createChannelUpdateCheckState(): ChannelUpdateCheckState {
	return { completedIps: [], inFlightIp: null };
}

export function startChannelUpdateCheck(
	state: ChannelUpdateCheckState,
	ip: string,
	connectionStatus: LocalServicesConnectionStatus,
): { state: ChannelUpdateCheckState; shouldStart: boolean } {
	if (
		connectionStatus !== "online" ||
		state.inFlightIp === ip ||
		state.completedIps.includes(ip)
	) {
		return { state, shouldStart: false };
	}

	return {
		state: { ...state, inFlightIp: ip },
		shouldStart: true,
	};
}

export function completeChannelUpdateCheck(
	state: ChannelUpdateCheckState,
	ip: string,
	succeeded: boolean,
): ChannelUpdateCheckState {
	const completedIps = succeeded
		? Array.from(new Set([...state.completedIps, ip]))
		: state.completedIps;

	return {
		completedIps,
		inFlightIp: state.inFlightIp === ip ? null : state.inFlightIp,
	};
}
