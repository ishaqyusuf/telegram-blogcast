import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Action = "build:preview" | "update:preview";
type CurrentIdentity = {
  email: string | null;
  username: string | null;
};

const APP_DIR = path.join(import.meta.dir, "..", "apps", "expo-app");

const ACTION_COMMANDS: Record<Action, string[]> = {
  "build:preview": ["bun", "run", "build:preview"],
  "update:preview": ["bun", "run", "update:preview"],
};

const action = process.argv[2] as Action | undefined;

if (!action || !(action in ACTION_COMMANDS)) {
  console.error(
    "Usage: bun ./scripts/eas-account-runner.ts <build:preview|update:preview>",
  );
  process.exit(1);
}

const env = { ...Bun.env };
delete env.EXPO_TOKEN;

const email = env.EAS_EMAIL?.trim();
const password = env.EAS_PASSWORD?.trim();
const configuredUsername = env.EAS_USERNAME?.trim().toLowerCase();

if (!email || !password) {
  console.error("Missing EAS_EMAIL or EAS_PASSWORD in the root environment.");
  process.exit(1);
}

const desiredIdentifiers = new Set(
  [email.toLowerCase(), configuredUsername].filter(Boolean),
);

const currentIdentity = await getCurrentIdentity();
const currentUsername = currentIdentity.username;
const currentEmail = currentIdentity.email?.toLowerCase() ?? null;

if (
  (currentEmail && currentEmail === email.toLowerCase()) ||
  (currentUsername && desiredIdentifiers.has(currentUsername.toLowerCase()))
) {
  console.log(
    `EAS session already matches ${currentEmail ?? currentUsername ?? email}.`,
  );
} else {
  if (currentUsername) {
    console.log(
      `Current EAS session is ${currentUsername}. Re-authenticating with ${email}.`,
    );
  } else {
    console.log(`No active EAS session found. Logging in with ${email}.`);
  }

  const session = await loginWithEmailAndPassword(email, password);
  await writeExpoSession(session);
  console.log(`Authenticated EAS session as ${session.username}.`);
}

await runOrExit(ACTION_COMMANDS[action], {
  cwd: APP_DIR,
  env,
  stdio: "inherit",
});

async function getCurrentIdentity(): Promise<CurrentIdentity> {
  const sessionSecret = await readSessionSecret();

  if (!sessionSecret) {
    return { email: null, username: null };
  }

  try {
    const easCliRoot = await resolveEasCliRoot();
    const createGraphqlClientModule = (await import(
      pathToFileUrl(
        path.join(
          easCliRoot,
          "build",
          "commandUtils",
          "context",
          "contextUtils",
          "createGraphqlClient.js",
        ),
      ).href
    )) as {
      createGraphqlClient: (authInfo: {
        accessToken: string | null;
        sessionSecret: string | null;
      }) => {
        query: (query: string, variables: Record<string, never>) => {
          toPromise: () => Promise<unknown>;
        };
      };
    };
    const clientModule = (await import(
      pathToFileUrl(path.join(easCliRoot, "build", "graphql", "client.js")).href
    )) as {
      withErrorHandlingAsync: <T>(promise: Promise<T>) => Promise<{
        meActor: {
          __typename?: string;
          username?: string;
          email?: string;
        } | null;
      }>;
    };

    const client = createGraphqlClientModule.createGraphqlClient({
      accessToken: null,
      sessionSecret,
    });

    const data = await clientModule.withErrorHandlingAsync(
      client
        .query(
          `
            query CurrentIdentity {
              meActor {
                __typename
                ... on User {
                  username
                  email
                }
                ... on SSOUser {
                  username
                }
              }
            }
          `,
          {},
        )
        .toPromise(),
    );

    return {
      email: data.meActor?.email ?? null,
      username: data.meActor?.username ?? null,
    };
  } catch {
    return { email: null, username: null };
  }
}

async function loginWithEmailAndPassword(emailValue: string, passwordValue: string) {
  const easCliRoot = await resolveEasCliRoot();
  const modulePath = path.join(easCliRoot, "build", "user", "fetchSessionSecretAndUser.js");

  const module = (await import(pathToFileUrl(modulePath).href)) as {
    fetchSessionSecretAndUserAsync: (input: {
      username: string;
      password: string;
      otp?: string;
    }) => Promise<{ sessionSecret: string; id: string; username: string }>;
  };

  return await module.fetchSessionSecretAndUserAsync({
    username: emailValue,
    password: passwordValue,
  });
}

async function writeExpoSession(session: {
  sessionSecret: string;
  id: string;
  username: string;
}): Promise<void> {
  const statePath = path.join(Bun.env.HOME ?? "", ".expo", "state.json");

  if (!Bun.env.HOME) {
    throw new Error("HOME is not set, so the Expo session path cannot be resolved.");
  }

  await mkdir(path.dirname(statePath), { recursive: true });

  let state: Record<string, unknown> = {};

  try {
    state = JSON.parse(await readFile(statePath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    const isMissingFile =
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT";

    if (!isMissingFile) {
      throw error;
    }
  }

  state.auth = {
    sessionSecret: session.sessionSecret,
    userId: session.id,
    username: session.username,
    currentConnection: "Username-Password-Authentication",
  };

  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function readSessionSecret(): Promise<string | null> {
  const statePath = path.join(Bun.env.HOME ?? "", ".expo", "state.json");

  if (!Bun.env.HOME) {
    return null;
  }

  try {
    const state = JSON.parse(await readFile(statePath, "utf8")) as {
      auth?: { sessionSecret?: string };
    };

    return state.auth?.sessionSecret ?? null;
  } catch (error) {
    const isMissingFile =
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT";

    if (isMissingFile) {
      return null;
    }

    throw error;
  }
}

async function resolveEasCliRoot(): Promise<string> {
  const easBinary = Bun.which("eas");

  if (!easBinary) {
    throw new Error("The `eas` command was not found in PATH.");
  }

  const wrapper = await readFile(easBinary, "utf8");
  const match = wrapper.match(/["']([^"']*node_modules\/eas-cli)\/bin\/run["']/);

  if (!match) {
    throw new Error("Unable to resolve the installed eas-cli package path.");
  }

  return match[1];
}

function pathToFileUrl(filePath: string): URL {
  return new URL(`file://${filePath}`);
}

async function runOrExit(
  cmd: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; stdio: "inherit" | "pipe" },
): Promise<void> {
  const proc = Bun.spawn({
    cmd,
    cwd: options.cwd,
    env: options.env,
    stdin: "inherit",
    stdout: options.stdio,
    stderr: options.stdio,
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
