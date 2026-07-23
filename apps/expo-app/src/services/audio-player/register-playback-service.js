let isPlaybackServiceRegistered = false;

function registerAndroidPlaybackService({
	platform,
	register,
	serviceFactory,
}) {
	if (platform !== "android" || isPlaybackServiceRegistered) {
		return false;
	}

	register(serviceFactory);
	isPlaybackServiceRegistered = true;
	return true;
}

module.exports = {
	registerAndroidPlaybackService,
};
