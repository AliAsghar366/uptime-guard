// Split out from session.ts so src/middleware.ts (Edge runtime) can reference the cookie name
// without pulling in session.ts's mysql2/next-headers imports, neither of which work on Edge.
export const SESSION_COOKIE_NAME = "session";