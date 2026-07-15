import * as React from "react"

const MOBILE_BREAKPOINT = 768

const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

// `useSyncExternalStore` rather than an effect that seeds state on mount: the
// viewport is an external store, and reading it through the subscription keeps
// the value correct on the first paint instead of rendering one frame at the
// wrong breakpoint. The server snapshot is `false` (desktop-first) because
// there's no viewport to measure during SSR.
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
