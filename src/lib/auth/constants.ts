// Split out from session.ts so src/proxy.ts can reference the cookie name without pulling in
// session.ts's postgres/next-headers imports.
export const SESSION_COOKIE_NAME = "session";