// env.mjs
import { z } from "zod";

const server = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    POSTGRES_URL: z.string().url(),
    DIRECT_URL: z.string().url(),

    // Telegram
    TELEGRAM_API_ID: z.string(),
    TELEGRAM_API_HASH: z.string(),
    TELEGRAM_STRING_SESSION: z.string(),
    TELEGRAM_BOT_TOKEN: z.string(),

    // Auth
    AUTH_SECRET: z.string().min(32),

    // Trigger.dev
    TRIGGER_SECRET_KEY: z.string(),
    TRIGGER_PROJECT_ID: z.string(),

    // Better Stack
    BETTERSTACK_TOKEN: z.string(),
});

const client = z.object({
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_NODE_ENV: z.enum(["development", "test", "production"]),
});

const processEnv = {
    // server
    NODE_ENV: process.env.NODE_ENV,
    POSTGRES_URL: process.env.POSTGRES_URL,
    DIRECT_URL: process.env.DIRECT_URL,

    // Telegram
    TELEGRAM_API_ID: process.env.TELEGRAM_API_ID,
    TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH,
    TELEGRAM_STRING_SESSION: process.env.TELEGRAM_STRING_SESSION,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,

    // Auth
    AUTH_SECRET: process.env.AUTH_SECRET,

    // Trigger.dev
    TRIGGER_SECRET_KEY: process.env.TRIGGER_SECRET_KEY,
    TRIGGER_PROJECT_ID: process.env.TRIGGER_PROJECT_ID,

    // Better Stack
    BETTERSTACK_TOKEN: process.env.BETTERSTACK_TOKEN,

    // client
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_NODE_ENV: process.env.NODE_ENV,
};

// --------------------------

const merged = server.merge(client);

/** @typedef {z.input<typeof merged>} MergedInput */
/** @typedef {z.infer<typeof merged>} MergedOutput */
/** @typedef {z.SafeParseReturnType<MergedInput, MergedOutput>} MergedSafeParseReturn */

let env = /** @type {MergedOutput} */ (process.env);

if (!!process.env.SKIP_ENV_VALIDATION == false) {
    const isServer = typeof window === "undefined";

    const parsed = /** @type {MergedSafeParseReturn} */ (
        isServer ? merged.safeParse(processEnv) : client.safeParse(processEnv)
    );

    if (parsed.success === false) {
        console.error(
            "❌ Invalid environment variables:",
            parsed.error.flatten().fieldErrors,
        );
        throw new Error("Invalid environment variables");
    }

    env = new Proxy(parsed.data, {
        get(target, prop) {
            if (typeof prop !== "string") return undefined;
            if (!isServer && !prop.startsWith("NEXT_PUBLIC_"))
                throw new Error(
                    process.env.NODE_ENV === "production"
                        ? "❌ Attempted to access a server-side environment variable on the client"
                        : `❌ Attempted to access server-side environment variable '${prop}' on the client`,
                );
            return target[/** @type {keyof typeof target} */ (prop)];
        },
    });
}

export { env };
