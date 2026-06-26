// Stub for the `server-only` package so server modules can be imported in unit tests.
// In the real app this package throws when pulled into a client bundle; under Vitest (Node)
// there's no such boundary, so an empty module is the correct no-op.
export {};
