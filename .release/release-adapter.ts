import { createAlghurobaaProviderBindings } from "./alghurobaa-provider-bundle";
import {
	type ConsumerReleaseContext,
	runConsumerReleaseCheck,
} from "./toolkit/ec653d87eb0b65bbac9235680d85eed6fdfd20a1/src/release/consumer";

export async function checkRelease(context: ConsumerReleaseContext) {
	const bindings = createAlghurobaaProviderBindings(context);
	return runConsumerReleaseCheck(context, bindings);
}
