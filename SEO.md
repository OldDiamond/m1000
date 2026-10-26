The site is static HTML/CSS/JavaScript built by `scripts/build.mjs` and deployed to GitHub Pages. There is no framework sitemap endpoint: the build writes `dist/sitemap.xml` using the same resolved routes it renders.

- Register regular pages in `src/pages.json`. Published articles in `content/posts.json` automatically receive routes using the existing article template, including articles not separately listed in `src/pages.json`.
- Mark unpublished entries with `published: false`, `draft: true`, or `status: "draft"`. Future `publishedAt` dates are excluded until publication. Error pages, redirects, noindex pages, canonical aliases and unregistered sample templates are excluded from the sitemap.
- All indexable pages have one self-referencing canonical on `https://www.m1000z.com`, with a trailing slash. Navigation anchors are rendered into the HTML; JavaScript enhances their existing animations and mobile menu.
- Set an optional `lastModified` on a page or post only when the date of a significant content update is known. Use `YYYY-MM-DD` or an ISO timestamp. Unknown dates are omitted; builds do not substitute publication times, filesystem times, current dates or unrelated commits.
- `public/robots.txt` permits crawling and points to the generated sitemap. The existing favicon configuration and domain redirects are unchanged.

Run `npm run build`, `npm run verify`, and `npm test`. Deployment runs these checks before publishing.

After deployment, submit `https://www.m1000z.com/sitemap.xml` in Search Console and inspect the canonical homepage, About, Blog and Projects URLs. The seven former web-design sample articles intentionally return HTTP 404 and must not be submitted for indexing. Their historical Search Console entries can remain until Google revisits them. The non-trailing-slash About/Blog/Projects URLs redirect to the canonical trailing-slash versions.

A valid sitemap and crawl access help discovery; they do not guarantee indexing. No Search Console account action is performed by these build scripts.
