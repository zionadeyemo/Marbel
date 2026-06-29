import { NextResponse } from "next/server";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Shared diagnostic context every route should pass alongside an error.
 * Routes extend this with whatever fields are relevant to them
 * (filename, mimeType, parserSelected, fileSizeBytes, skillLevel, etc).
 */
export type ErrorContext = Record<string, unknown> & {
  requestPath: string;
};

/**
 * `ERR-YYYYMMDD-XXXXXX` — sortable by date, short enough to read aloud or
 * paste into a support ticket, unique enough to grep a single occurrence
 * out of the server logs.
 */
export function generateErrorId(): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ERR-${ymd}-${suffix}`;
}

function describeError(err: unknown) {
  return {
    errorType: err instanceof Error ? err.constructor.name : typeof err,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  };
}

/**
 * For unexpected/internal failures (bugs, third-party outages, anything not
 * already a deliberate validation response). Always logs the full exception
 * server-side with an errorId; the client only ever sees a generic message
 * plus that errorId in production, full diagnostics in development.
 */
export function handleUnexpectedError(
  err: unknown,
  context: ErrorContext,
  publicMessage = "Something went wrong."
): NextResponse {
  const errorId = generateErrorId();
  const { errorType, message, stack } = describeError(err);

  console.error(`[${context.requestPath}] Unexpected error [${errorId}]`, {
    errorId,
    errorType,
    message,
    stack,
    ...context,
  });

  const body: Record<string, unknown> = { error: publicMessage, errorId };

  if (isDev) {
    body.debug = { ...context, errorType, message, stack };
  }

  return NextResponse.json(body, { status: 500 });
}

/**
 * For expected, user-actionable failures (bad input, unsupported file type,
 * upstream returned no usable content, etc). The thrown error's `.message`
 * IS the public-facing message — these don't need an errorId since the user
 * already knows what to do about them. Still logged in full for traceability.
 */
export function handleKnownError(
  err: Error,
  status: number,
  context: ErrorContext
): NextResponse {
  const { errorType, message, stack } = describeError(err);

  console.error(`[${context.requestPath}] ${status} response`, {
    errorType,
    message,
    ...context,
  });

  const body: Record<string, unknown> = { error: message };

  if (isDev) {
    body.debug = { ...context, errorType, message, stack };
  }

  return NextResponse.json(body, { status });
}
