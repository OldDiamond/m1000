Published articles are stored in `content/posts.json` and `content/articles/`. The existing Node build renders them into static HTML, listing cards, related-post links, BlogPosting JSON-LD and the canonical sitemap. No framework, CMS or production dependency was added.

The three new articles are original explanatory analyses of public research, not claims of personal discovery or laboratory exploitation. Their original SVG artwork is self-contained, contains no external images or logos, and uses the site's ice-blue palette. Matching 1200×630 PNG exports are provided for social metadata and structured-data images. The existing CWES article body, URL and images are preserved.

Verified on November 3, 2026:

| Topic | Verified facts | Primary evidence |
| --- | --- | --- |
| CVE-2026-98432 | IPv4 TCP memory-lifetime race; Linux 4.4 onward; demonstrated remote execution with an MPTCP listener; distribution-specific patching and restart requirements | [AWS bulletin](https://aws.amazon.com/security/security-bulletins/2026-160-aws/), [Akamai patch analysis](https://www.akamai.com/blog/security-research/cve-2026-98432-remote-uaf-linux-kernels-tcp-stack), [original research disclosure](https://www.anthropic.com/research/discovering-vulnerabilities-with-claude), [Ubuntu Security Team](https://ubuntu.com/blog/fixes-available-in-proposed-pocket-for-cve-2026-98432) |
| CVE-2026-110447 | Optional richdocumentscode app before 26.4.303; stopped CODE server prerequisite; execution as web-server user; disabling alone insufficient; standalone Collabora unaffected | [Collabora vendor advisory](https://github.com/CollaboraOnline/online/security/advisories/GHSA-g3vx-3m76-fghh), [NVD record](https://nvd.nist.gov/vuln/detail/cve-2026-110447), [OWASP defensive guidance](https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html) |
| CVE-2026-109618 / CVE-2026-109619 | OOM interruption and stale worker state; deployment-specific demonstrated/conditional cases; fixed PHP releases 8.2.35, 8.3.36, 8.4.27, 8.5.12; separate subsequent session guidance; vendor-reported exploitation | [PHP announcements](https://www.php.net/archive/2026.php), [OOM advisory](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w), [stale-state advisory](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp), [Unit 42 observations](https://unit42.paloaltonetworks.com/cve-2026-109618-cve-2026-109619/) |

The supplied Openwall archive URL and Collabora blog URL could not be reliably retrieved during research. They are not used to support unverified claims; the articles link the accessible vendor advisories and original research above instead. No reference-site article text, branding or imagery was reused.

Version and exploitation-status statements are attributed and dated where necessary. Vendor advisories can change; future substantive edits should update the post's `lastModified`. The build estimates reading time from the full article at 200 words per minute and sorts published cards newest first.

Validation: run `node scripts/build.mjs`, `node scripts/verify.mjs`, and `node --test scripts/*.test.mjs` (equivalent to the package build/verify/test commands). Blog validation checks full articles, dates, unique routes, reading times, JSON-LD, research references, original covers and recommendations; existing favicon, SEO and public-file checks still run.

Google Search Console is not modified by this build. After deployment, the existing sitemap automatically includes the three new canonical URLs. Optional URL Inspection requests can be made for those URLs; indexing remains Google's decision.

Created files:

- `content/articles/linux-tcp-use-after-free.html`
- `content/articles/nextcloud-code-proxy-command-injection.html`
- `content/articles/php2shell-request-lifecycle.html`
- `public/assets/blog/tcp-lifetime.svg` and `tcp-lifetime-social.png`
- `public/assets/blog/document-trust-boundary.svg` and `document-trust-boundary-social.png`
- `public/assets/blog/php-worker-lifecycle.svg` and `php-worker-lifecycle-social.png`
- `scripts/verify-blog.mjs`
- `BLOG-RESEARCH.md`

Modified files:

- `content/posts.json`
- `scripts/build.mjs`, `scripts/site-pages.mjs`, `scripts/serve.mjs`, `scripts/verify.mjs`
- `src/components/BlogCard.html`, `src/components/PostArticle.html`
- `src/blog-search.js`
- `src/styles/theme.css`, `src/styles/blog-search.css`, `src/styles/article.css`

The development server adds the SVG MIME type. The production favicon files and declarations, domain redirects, robots.txt, existing article URLs, navigation and footer are unchanged. The shared blog preview shows the three newest articles on Home; the Blog page retains all four published posts.
