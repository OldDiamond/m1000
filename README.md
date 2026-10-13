# Editable portfolio

Recreation of the supplied [Majd reference](https://majd-portfolio.framer.website/), with its home sections, six projects, seven articles, imagery, typography, and responsive styles. No framework installation or package dependencies are required.

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

To replace a photo, put the new file in `public/assets/media/` and change its image value to `/assets/media/your-photo.jpg`. The two portrait entries represent front and back views; update both. The original source asset URLs are mapped to downloaded files by `content/assets.json` at build time.

Section names follow the reference. Framer's generated CSS classes are retained to preserve the visual design, while editable content and complete sections are separated. These are HTML components, not React components or an editable Framer project.

The statement size is controlled by `--quote-font-size` (30px) in `src/styles/custom.css`. That file also holds readable body sizes, the expanding navigation, centered sliding icons, and testimonial flip styles. `setupScrollMotion` in `src/interactions.js` controls the desktop portrait's growth and rotation; it respects reduced-motion preferences and keeps the reference's static portrait on smaller screens.

The statement reveal starts when the top of its text reaches 85% of the viewport and continues through the first half viewport of scrolling, reading from the first word in order even while the text is pinned at the center. `setupDecorations` restores dragging and release momentum for the hero's metallic shapes. Focus a shape and use arrow keys to move it; Escape resets its position. Reduced motion disables release momentum.

Service descriptions sit beside their headings on desktop and tablet, and stack on phones. All arrow buttons share a diagonal slide and growing circular fill on hover or keyboard focus, defined by the `Arrow Button` selectors in `src/styles/custom.css`.

The blue-violet curtain background is anchored to the top of each page and scrolls out of view after the first viewport. Edit `backgroundCurtains` in `content/settings.json` to adjust its two hex colors, intensity (0–1), speed, or enabled state. `src/curtain.js` renders the folds at up to 30 fps, pauses while offscreen or the tab is hidden, and stays still for reduced motion. A CSS fallback is available when WebGL is unsupported. The center and lower background fade into the original paper color; navigation, text, cards, and footer retain their colors. The page scrollbar uses a light paper track and a muted violet-gray thumb.

## Forms

The contact form validates required fields and opens an email draft to `contactEmail`. It does not send mail automatically. Set `contactEndpoint` to an HTTPS service that accepts JSON to enable submission. The request contains `Name`, `Email`, and `Project`.

Article newsletter forms need `newsletterEndpoint`, accepting JSON with the source form's email field. Until connected, they explicitly report that signup is unavailable. No fake success state is displayed. Your form service must allow requests from the final website domain.

## Routes

- `/` — hero, biography, quote, services, featured projects, testimonials, thoughts, contact, footer.
- `/work` — project collection.
- `/work/damas`, `/work/najm`, `/work/kavi`, `/work/sham`, `/work/abjad`, `/work/fasselh` — project details. `fasselh` preserves the reference URL spelling.
- `/blog` — article collection.
- Seven `/blog/<slug>` article pages, listed in `src/pages.json`.

`/#bio-section`, `/#services`, and `/#contact` are homepage anchors. These are pages and sections under one domain, not separate subdomains. Hosting under the original owner's `majd-portfolio.framer.website` address requires their Framer access; this project cannot claim that address.

## Review notes

See `REFERENCE-REVIEW.md` for the reference's components, existing content issues, and fidelity limits. Replace the reference's identity, testimonials, sample project content, email, and social destinations when personalizing it.

## Validation and deployment

```sh
node scripts/verify.mjs
```

The check validates compiled pages, internal routes, component insertion, local assets, and absence of third-party runtime scripts. The static output is `dist/`; the Sites identity and static directory are declared in `.openai/hosting.json`. When hosting elsewhere, deploy the entire `dist` directory with directory-index support, including nested project and article folders.
