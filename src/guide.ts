// Open the full guide. The guide is rendered from GUIDE.md to a real static page
// (public/guide.html) at build time by scripts/build-guide.mjs — so opening it is
// a normal pageview (free analytics counts "guide opens") and `marked` stays out
// of the client bundle. BASE_URL keeps the link correct under any deploy base.

export function openGuide(): void {
  window.open(import.meta.env.BASE_URL + 'guide.html', '_blank', 'noopener')
}
