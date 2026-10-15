# Editable portfolio

The current site name is **m1000z**, used in navigation, page titles, the footer, and the opening animation. Footer names fit the available width and show their upper three quarters at the bottom edge.

Recreation of the supplied [Majd reference](https://majd-portfolio.framer.website/), customized for a web security portfolio with NetNeedle, seven articles, and an editable About page. No framework installation or package dependencies are required.

## Run locally

With Node.js 22 or later:

```sh
npm run build
npm run dev
```

Open `http://localhost:3000`. After changing source or content, rebuild and refresh. You can also run `node scripts/build.mjs` and `node scripts/serve.mjs` directly.

## Where to edit

| Change | File |
| --- | --- |
| Your name, navigation, quote, copyright year, contact recipient, form endpoints | `content/settings.json` |
| Page text, image URLs, image descriptions, links | `content/portfolio.json` |
| Page titles, descriptions, routes, section order | `src/pages.json` |
| Shared navigation component | `src/components/Header.html` |
| Section structure | Named HTML files in `src/components/` |
| Page shells | `src/pages/` |
| Typography, sizes, spacing and source responsive styles | `src/styles/<page>.css` |
| Shared visual adjustments | `src/styles/custom.css` |
| Menu and form behavior | `src/interactions.js` |
| Local images and fonts | `public/assets/media/` |

`portfolio.json` is grouped by page. Entries have a readable `label` and an editable `value`. `text` fields contain plain text; `html` fields retain article links and formatting. `image` fields also expose `alt`. Keep entry keys intact: they bind content to `data-edit`, `data-edit-image`, or `data-edit-link` attributes in the components. Only use trusted HTML in rich text fields.

NetNeedle is the single project on the homepage and `/work`, with its detail page at `/work/netneedle`. Edit its cards in the `home` and `work` groups and its case study in `work--netneedle`. Product facts and original screenshots come from the [NetNeedle repository](https://github.com/OldDiamond/NetNeedle). The four local screenshots are in `public/assets/netneedle/`; they display without cropping. The previous template project pages have been removed.

The `/about` page has your two education entries and two work experience entries. Edit the `about` group in `content/portfolio.json`: each entry has dates, a degree or role title, an institution or company, and a description. Keep the latest entry first. Add or remove rows in `src/components/about--1--education.html` and `src/components/about--2--experience.html`; new rows need unique `data-edit` keys and matching content entries. `src/styles/about.css` reuses the Projects page's typography and footer styles, then defines the year and details columns. On phones, the date sits above the details.

The About page's **Download CV** button stays inactive until a CV is supplied. Put the PDF in `public/assets/`, set `cvUrl` in `content/settings.json` to its path (for example `/assets/mohammad-yasin-cv.pdf`), and rebuild to activate the download link. The outlined arrow matches the site's existing button animations.

To replace a photo, put the new file in `public/assets/media/` and change its image value to `/assets/media/your-photo.jpg`. The two portrait entries represent front and back views; update both. The original source asset URLs are mapped to downloaded files by `content/assets.json` at build time.

The current hero uses the supplied original `portrait-grayscale-v3.png` on the front and `portrait-red-v3.png` on the back. Both use the supplied original files, aligned toward the top to keep the hair in view. A small CSS zoom inside the existing frame hides the uploaded white borders. Edit `home.image-77` and `home.image-76` in `content/portfolio.json` to replace them. The grayscale view stays visible on smaller screens and for reduced motion; the desktop scroll rotation reveals the red view.

Section names follow the reference. Framer's generated CSS classes are retained to preserve the visual design, while editable content and complete sections are separated. These are HTML components, not React components or an editable Framer project.

The statement size is controlled by `--quote-font-size` (30px) in `src/styles/custom.css`. That file also holds readable body sizes, the expanding navigation, and centered sliding icons. `setupScrollMotion` in `src/interactions.js` controls the desktop portrait's growth and rotation; it respects reduced-motion preferences and keeps the reference's static portrait on smaller screens.

The statement stays muted while entering the viewport. Its reveal begins with the first word once the paragraph is centered and pinned, then progresses across the full sticky scrolling distance. Scrolling back reverses the same word order. `setupDecorations` restores dragging and release momentum for the hero's metallic shapes. Focus a shape and use arrow keys to move it; Escape resets its position. Reduced motion disables release momentum.

Service descriptions sit beside their headings on desktop and tablet, and stack on phones. All arrow buttons share a diagonal slide and growing circular fill on hover or keyboard focus, defined by the `Arrow Button` selectors in `src/styles/custom.css`.

The burgundy curtain background is anchored to the top of each page and scrolls out of view after the first viewport. Edit `backgroundCurtains` in `content/settings.json` to adjust its `primaryColor` and `secondaryColor` hex colors, intensity (0–1), speed, or enabled state. `src/curtain.js` renders the folds at up to 30 fps, pauses while offscreen or the tab is hidden, and stays still for reduced motion. A CSS fallback is available when WebGL is unsupported. The center and lower background fade into the original paper color; navigation, text, cards, and footer retain their colors. The page scrollbar uses a light paper track and a muted burgundy-gray thumb.

The footer's ASCII hands approach from both sides as you scroll to the footer, behind the copy and above the large name. The brighter coral-orange characters use 80% opacity. Their scroll movement eases at both ends and follows scrolling with 160ms damping; rendering stops once they settle. There is no mouse tracking, hover scrambling, or hover movement. Edit `footerHands` in `content/settings.json` for color, opacity, character density, or visibility. `src/footer-hands.js` converts local hand silhouettes into text; reduced motion displays their final positions. The silhouettes come from the user-supplied [Luke Baffait footer reference](https://lukebaffait.fr/), and are stored in `public/assets/hands/`.

The homepage opens with black dots gathering into `[m1000z]`, spreading into a square grid, then flowing into the hero heading and portrait. The ending follows the live heading's font and line wrapping and the visible portrait's transformed bounds; those elements emerge in place as the remaining background clears. The final dots stay inside the photograph's outline and the heading's letter shapes, keeping both edges clean. The portrait is decoded in advance and revealed through one dissolve to avoid flashing the paper background. Edit `openingDots` in `content/settings.json` to change the name, duration in milliseconds (default 5600), or visibility. It plays on the first homepage visit per tab; refreshing replays it, while internal return visits skip it. Set `oncePerSession` to `false` to play on every homepage visit. Reduced motion skips the intro, Escape dismisses it, and other routes open directly. `src/components/OpeningDots.html` and `src/opening-dots.js` contain the component and animation; no reference-site runtime or media is required.

## Forms

The contact form validates required fields and opens an email draft to `contactEmail`. It does not send mail automatically. Set `contactEndpoint` to an HTTPS service that accepts JSON to enable submission. The request contains `Name`, `Email`, and `Project`.

Article newsletter forms need `newsletterEndpoint`, accepting JSON with the source form's email field. Until connected, they explicitly report that signup is unavailable. No fake success state is displayed. Your form service must allow requests from the final website domain.

## Routes

- `/` — hero, biography, quote, services, featured projects, thoughts, contact, footer.
- `/about` — education and work experience arranged by year.
- `/work` — project collection.
- `/work/damas`, `/work/najm`, `/work/kavi`, `/work/sham`, `/work/abjad`, `/work/fasselh` — project details. `fasselh` preserves the reference URL spelling.
- `/blog` — article collection.
- Seven `/blog/<slug>` article pages, listed in `src/pages.json`.

`/#bio-section`, `/#services`, and `/#contact` are homepage anchors. These are pages and sections under one domain, not separate subdomains. Hosting under the original owner's `majd-portfolio.framer.website` address requires their Framer access; this project cannot claim that address.

## Review notes

See `REFERENCE-REVIEW.md` for the reference's components, existing content issues, and fidelity limits. Replace the reference's identity, sample project content, email, and social destinations when personalizing it.

## Validation and deployment

```sh
node scripts/verify.mjs
```

The check validates compiled pages, internal routes, component insertion, local assets, and absence of third-party runtime scripts. The static output is `dist/`; the Sites identity and static directory are declared in `.openai/hosting.json`. When hosting elsewhere, deploy the entire `dist` directory with directory-index support, including nested project and article folders.
