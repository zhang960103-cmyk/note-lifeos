# Code splitting measurements

Production builds of baseline `09840f8` (`fix/supabase-types`) and this branch,
using the same installed dependencies, Node 24.19.0 and npm 11.9.0.
No Supabase values were supplied to either build. Sizes are decimal kB.
Gzip uses Python `gzip.compress(bytes, mtime=0)`; total gzip is the sum of
individually compressed JavaScript files, not a compressed directory.

| JavaScript | Before raw / gzip kB | After raw / gzip kB |
| --- | ---: | ---: |
| HTML module entry | 1207.76 / 367.98 | 703.14 / 214.70 |
| MapPage | 608.53 / 155.27 | 8.60 / 3.14 |
| three.js standalone | Included in MapPage | 600.12 / 152.25 |
| All JS chunks combined | 2465.22 / 708.69 | 2471.79 / 721.39 |

The entry decreases by 41.8% raw and 41.7% gzip. Total output increases
slightly (0.3% raw, 1.8% gzip) because splitting adds module boundaries and
reduces cross-file compression. This is deferred loading, not removal of
three.js or a claim that all pages download fewer bytes overall.
The entry is selected from the module script in `dist/index.html`, rather than
the first `index-*.js` file: Vite also emits a smaller shared index chunk.

All route pages now use `React.lazy`. A top-level Suspense boundary covers
authentication and password reset, and the existing layout boundary covers
authenticated routes. `GoalsPage` no longer becomes a static dependency of
HomePage: its goal update helper is moved unchanged to `src/lib/goalProgress.ts`.
Three.js is fetched as a separate dependency of the lazy map page.

Validation: TypeScript has zero errors; 33 tests pass, including direct lazy
privacy, password-reset and not-found routes; production build and lint pass.
The five baseline unused ESLint suppression warnings are handled separately
by `fix/lint-warnings`. Large entry/three.js chunk warnings remain.
No real Supabase backend or authenticated end-to-end workflow was tested.
