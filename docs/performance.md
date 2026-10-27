# Performance verification

Measured on October 27, 2026 with Node v24.22.1, darwin, Apple M5, Lighthouse 13.5.0 and the production Next build. These are local simulated-mobile lab runs against the explicit seeded Onyx HTTP transport, not live Onyx latency or field measurements.

| Route              | Performance | Accessibility | Best practices | SEO |    LCP |    CLS |
| ------------------ | ----------: | ------------: | -------------: | --: | -----: | -----: |
| /                  |          99 |           100 |            100 | 100 | 2.16 s | 0.0000 |
| /about             |          99 |           100 |            100 | 100 | 2.15 s | 0.0004 |
| /resources         |          99 |           100 |            100 | 100 | 2.16 s | 0.0000 |
| /resources/example |          97 |           100 |            100 | 100 | 2.52 s | 0.0015 |

All routes meet the unchanged inherited thresholds: Performance ≥90, Accessibility ≥95, Best Practices ≥95, SEO ≥95. Default mobile simulated throttling and four-times CPU slowdown were used. Reproduce with `npm run perf`; reports are ignored under `reports/lighthouse`. Set `PERF_URL` to measure an already running configured production instance.

Production bundle analysis confirms the public catch-all route has nine client outputs without Lexical, admin modules or privileged Onyx SDK code. Run `npm run analyze` then `npm run bundle:check`. Public pages also pass the inherited no-JavaScript browser and accessibility checks.

The clean-copy smoke test passed a fresh dependency install, project naming, full check/build and all fourteen desktop/mobile browser checks. New CMS checks cover verified sign-in, editorial changes, private previews, revision restoration, media visibility and role denials. This does not verify an external Onyx deployment or production Firebase grants.

Field targets remain LCP ≤2.5 s, INP ≤200 ms and CLS ≤0.1 at the 75th percentile. Lab Lighthouse does not establish field INP, real-user performance, external database latency or search rankings. No telemetry vendor is included.
