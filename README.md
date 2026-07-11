# ev-charge-calc

A mobile-friendly website that estimates how long it will take to charge your EV, from battery
capacity, current/target state of charge, and charger rate. It supports favourite chargers, a
"simulate charge" mode for when your EV or charger app has no connectivity, an advanced section
for voltage/current/max-charge-rate, and a searchable EV database to prefill vehicle specs.

This project is open source (MIT licensed) — contributions are welcome, including pull requests
that add or correct entries in the vehicle database (`data/vehicles.json`). See the schema and
disclaimer at the top of that file: each entry needs a unique kebab-case `id`, and specs are
community-sourced approximations rather than manufacturer-verified figures.

No build tooling, framework, or bundler is used — it's hand-written HTML, CSS, and vanilla
JavaScript ES modules. The only "build step" is a small Node script that stamps a build timestamp
used by the staging environment's build-time badge.

All user data (charge levels, favourite chargers, advanced settings) is stored only in a single
first-party cookie on your device — nothing is ever sent to a server. See [`privacy.html`](privacy.html)
for details.

## Local development

No install or build step is required to view the site — it's static files.

```sh
npx serve .
# or
python3 -m http.server
```

Then open the printed local URL in your browser.

`npm run build` only regenerates `build-info.json` (used by the staging build-time badge) — it's
not needed for local development, only run automatically by Cloudflare Pages on deploy.

## Deploying to Cloudflare Pages

1. Push this repo to GitHub.
2. In the Cloudflare dashboard, create a Pages project and connect it to the GitHub repo.
3. Set the build command to `npm run build` and the build output directory to `/` (repo root).
   Set the production branch to `main`.
4. Enable preview/branch deployments so pushes to a `staging` branch also build and deploy.
5. Under **Custom Domains**, map `evcharge.helpful.stream` to the Production environment
   (`main` branch), and map `staging.evcharge.helpful.stream` to the `staging` branch specifically.
6. Push to `main` to deploy production. Push/merge to `staging` to deploy the staging environment,
   which additionally shows a "Built Xd Xh Ym ago" badge in the footer (hidden on production).

No environment variables or secrets are needed — this is a fully static site with no server-side
logic.

## License

MIT — see [LICENSE](LICENSE).
