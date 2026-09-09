export function trpcErrorLogDetails(options: {
  path?: string;
  input: unknown;
  url: string;
  error: { message: string; code: string; name: string; stack?: string };
}) {
  const privateAnnotation = options.path?.startsWith("bookAnnotation.") ||
    /(?:\/|,)bookAnnotation\./.test(options.url);
  if (!privateAnnotation) return {
    input: options.input,
    url: options.url,
    errorMessage: [options.error.message, options.error.code, options.error.name, options.error.stack],
  };
  // Database/validation exceptions may echo payloads in messages and stack traces.
  return {
    input: "[REDACTED]",
    url: options.url.split("?")[0],
    errorMessage: ["Private annotation request failed", options.error.code],
  };
}
