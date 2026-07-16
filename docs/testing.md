# Testing architecture

The regression gate follows the product boundaries instead of treating every test as one undifferentiated suite.

| Layer | Protects | Command |
| --- | --- | --- |
| Vitest | domain rules, access policy, database query behavior, API routes, background jobs, and React rendering | `npm run test:coverage` |
| Playwright | public navigation, sign in, protected route redirects, and mobile route layout | `npm run test:e2e` |
| Node test runner | Recall desktop SDK sidecar lifecycle and capture fallback | `npm run test:sidecar` |
| Swift Testing | macOS recorder state, API requests, scheduling, and local capture behavior | `npm run test:swift` |
| Python unittest | MCP query safety and read only boundaries | `npm run test:mcp` |

`npm run verify` is the portable release gate. It runs lint, coverage thresholds, the production build, sidecar tests, and MCP tests. On macOS, `npm run verify:all` also runs the Swift and browser suites.

Pull requests and pushes to `main` run every layer in GitHub Actions. The coverage thresholds make newly added untested behavior fail the gate. The test suite health check also requires each new API route to have a direct route test unless it is a thin framework adapter with an explicit adapter assertion.

Tests should protect observable behavior and security boundaries. A regression test should reproduce the failure before its implementation changes. Use synthetic data and mock vendor network calls.
