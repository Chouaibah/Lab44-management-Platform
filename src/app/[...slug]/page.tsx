'use client'

/**
 * Catch-all route — handles any URL like /student-choice, /admin-panel,
 * /instructor-grades, etc. when the user hits refresh or pastes a deep link.
 *
 * Without this file, Next.js returns a 404 for every path that isn't "/"
 * because those paths have no server-side page files — they only exist as
 * client-side pushState entries produced by the Zustand store.
 *
 * Lab44App's own routing logic (getViewFromUrl → handleRouting) reads
 * window.location.pathname, verifies the session, and navigates to the
 * correct view — or redirects to login if the session is gone.
 */

import Lab44App from '@/components/Lab44App'

export default function CatchAllPage() {
  return <Lab44App />
}
