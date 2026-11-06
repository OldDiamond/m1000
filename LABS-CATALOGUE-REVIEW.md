# Security Labs catalogue review

Prepared on 6 November 2026. Scope: the Labs catalogue and shared navigation/footer integration. The existing main-branch GitHub Pages workflow handles website deployment. Hosting configuration and the live lab application were not changed.

## Result

`/labs/` reuses the Blog page shell, shared background, footer, typography assets, theme colours, and glass card presentation. It contains the requested heading/introduction and one published Northline Billing card with the existing animated IDOR WebP thumbnail, GIF fallback, and a static poster for reduced-motion preferences. The thumbnail fills a slightly landscape frame using `object-fit: cover`, with a small crop and no distortion or empty side strips.

Cards are capped at 440px. Mobile uses one column without a sidebar; adding published records to `content/labs.json` automatically creates more cards and desktop columns. Each card has separate keyboard-accessible links for the live demo, walkthrough, and local setup. The card was subsequently shortened through a slightly shallower thumbnail and tighter spacing, while retaining all copy, the width, and at least 44px action targets.

A slow blue/lilac gradient wash now occupies only the lower Labs catalogue band above the footer, in the position marked by the user. It uses three locally rendered CSS gradient layers, masks at the edges, and transform animations. It leaves the shared background image and its positioning untouched. The decorative layer is hidden from assistive technology, cannot intercept clicks, and stops moving for reduced-motion preferences.

Labs appears in the shared desktop/mobile navigation and every content-page footer. Desktop navigation has a 760px maximum width and keeps labels on one line. The existing compact tablet and mobile menu behaviour remains in use.

The page uses the existing route/SEO pipeline:

- Title: `Security Labs | m1000z`
- Description: `Hands-on web security labs. Explore the application, follow the walkthrough, and understand the fix.`
- Canonical and generated sitemap entry: `https://www.m1000z.com/labs/`
- `/labs/idor/setup/` remains a separate published guide with its original canonical URL.

## Changed files

| File | Change |
| --- | --- |
| `content/labs.json` | Published lab data, thumbnail reference, links, difficulty and hosted/local behaviour note. |
| `content/settings.json` | Labs in shared desktop/mobile navigation. |
| `src/pages.json` | Catalogue route, existing template/style reuse, title and description. |
| `src/components/LabsCatalogue.html` | Catalogue heading, introduction, grid, visible difficulty explanation and decorative lower gradient layer. |
| `src/components/LabCard.html` | Reusable semantic card with three separate links and behaviour note. |
| `src/components/FooterLabsLink.html` | Shared footer link using the existing link presentation. |
| `src/styles/labs.css` | Responsive catalogue/card layout, compact spacing, thumbnail sizing, accessible action styles and Labs-only gradient animation. |
| `src/styles/theme.css` | Navigation width/label fit and footer link typography. |
| `scripts/build.mjs` | Render published lab records, reuse the Blog stylesheet, include catalogue styles, and insert the shared footer link. |
| `scripts/verify-seo.mjs` | Validate navigation count and destinations against settings instead of a fixed five-link count. |
| `LABS-CATALOGUE-REVIEW.md` | This review and validation record. |

The existing article, setup-guide body, Blog source, post data, thumbnail assets, downloadable ZIP and live/standalone application sources were not edited. Existing unrelated local work was retained.

## Hosted/local behaviour verification

Read-only requests to `https://labs.m1000z.com/` and `https://labs.m1000z.com/guide` returned HTTP 200. The live guide rendered `data-mode="corrected"`, `Training · Corrected`, and `Current mode: Corrected`. The checked-in standalone configuration also defaults hosted operation to corrected access controls, and its Render configuration specifies `LAB_MODE=corrected`.

The actual downloadable `public/assets/documents/hunting-idor-lab.zip` contains vulnerable startup and the `--secure` corrected mode. Its verifier was run from a fresh temporary extraction without changing the archive or source lab. All 84 checks passed: 16 invoice API, 16 detail-page, 26 authentication, 16 scope, six asset, and four empty-state checks.

The catalogue explains both modes in a short card note and separately states that Easy lab describes learning difficulty, not vulnerability severity.

## Validation

The package script targets were executed with the available Node 22.16.0 runtime:

| Check | Result |
| --- | --- |
| `build` / `node scripts/build.mjs` | Passed; 10 pages built and public-file safety checks passed. |
| `verify` / `node scripts/verify.mjs` | Passed; 367 page/link/asset checks, nine sitemap URLs, canonical/crawl validation, favicon checks and both published posts. |
| `test` / `node --test scripts/*.test.mjs` | All 11 tests passed. |
| `verify:review` / `node scripts/verify-idor-review.mjs` | Passed; existing IDOR publication, setup, resources, approved assets and ZIP verified. |
| `git diff --check` | Passed. |

Headless Microsoft Edge browser QA passed at widths **320, 390, 768, 810, 1024, 1440 and 1920px**:

- No horizontal overflow or browser/runtime errors; desktop navigation links fit inside the bar.
- Card widths were 280px at 320, 350px at 390, and bounded at 440px on larger screens.
- Thumbnail image filled the frame using `object-fit: cover`, preserving the artwork's proportions with a small crop.
- Action targets were at least 44px high and showed visible keyboard focus outlines.
- Mobile menu opened with Enter; Tab reached Labs; Enter activated it; Escape closed the menu and restored focus to its toggle.
- Walkthrough and local-setup links were followed using the keyboard and reached their original routes. The live link matched the verified HTTPS destination.
- All three actions and navigation were available without JavaScript.
- A temporary second card added only in the browser confirmed one mobile/tablet column and two desktop columns; it was never written into content or output files.
- Regression checks covered Home, About, Projects, Blog, the IDOR article and setup guide at 390, 768 and 1440px. Blog search still returned the IDOR article. All nine content pages contained exactly one static Labs footer link.

Local QA evidence, intentionally excluded from version control:

- `.openai/labs-catalogue.local.mjs` — browser verification script (starts and stops its own local preview server).
- `.openai/labs-catalogue-qa.local.json` — measurements and regression results.
- `.openai/labs-catalogue-390.local.png`
- `.openai/labs-catalogue-768.local.png`
- `.openai/labs-catalogue-1440.local.png`
- `.openai/labs-menu-390.local.png`

The mobile, tablet and desktop screenshots were visually inspected. After the animation correction, browser checks at 390, 768 and 1440px confirmed five or six distinct rendered animation frames per width, correct WebP selection, static poster selection for reduced motion, and no overflow. The build, site verification and all 11 existing tests passed again.

The generated site is available under `dist/`. QA-owned preview servers were stopped; `http://localhost:3000` remains running at the user's request.

## Lower gradient and compact card follow-up

Browser checks at 390, 768 and 1440px confirmed unchanged card widths and measured height reductions of approximately 71, 77 and 85px respectively. The desktop card is now approximately 791px tall instead of 877px. All text and links remain present.

The gradient was verified to change visibly between animation times, remain within the lower catalogue band above the footer, ignore pointer input and stop animating under reduced-motion preferences. Blog, Projects, the IDOR article and the setup guide contain neither this decorative layer nor its stylesheet. Mobile and desktop captures were visually inspected:

- `.openai/labs-compact-390.local.png`
- `.openai/labs-compact-768.local.png`
- `.openai/labs-compact-1440.local.png`
- `.openai/labs-gradient-region-1440.local.png`
- `.openai/labs-compact-qa.local.json`
