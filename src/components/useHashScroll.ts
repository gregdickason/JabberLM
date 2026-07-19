import { useEffect } from 'react'

// SPA fragment deep-links (e.g. `explain.html#cost`) don't auto-scroll: the target
// section is rendered by React *after* the browser's one-time scroll attempt on load,
// so the browser finds nothing and stays at the top. This scrolls to the hash target
// once the DOM has painted — on mount, whenever `dep` changes (e.g. after the model
// loads and layout settles), and on `hashchange`. On-page anchor clicks already work
// natively (the element exists); this only rescues the initial-load / cross-page case.
export function useHashScroll(dep?: unknown) {
  useEffect(() => {
    const scrollToHash = () => {
      const id = decodeURIComponent(window.location.hash.replace(/^#/, ''))
      if (!id) return
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ block: 'start' })
    }
    const raf = requestAnimationFrame(scrollToHash) // wait for this render to commit
    window.addEventListener('hashchange', scrollToHash)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('hashchange', scrollToHash)
    }
  }, [dep])
}
