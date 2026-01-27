/**
 * Consolidation of professional web development skills (UI/UX, Performance, Architecture)
 * used as a baseline for all AI generation and upgrade tasks.
 */
export const DEFAULT_SKILLS = `
--- MODERN WEB DEVELOPMENT STANDARDS (2026) ---

1. MODERN UI/UX DESIGNS:
- Premium Aesthetics: Avoid basic colors. Use HSL-based palettes, glassmorphism (backdrop-filter: blur(10px)), and smooth multi-stop gradients.
- Fluidity: Use expressive, organic layouts with border-radius (12px-24px) and smooth cubic-bezier transitions.
- Visual Hierarchy: Aggressive use of whitespace, crisp SVG icons (Lucide/Heroicons), and multi-layered shadows for depth.

2. WEB PERFORMANCE & VITALS:
- LCP (< 2.5s): Prioritize main hero content, use fetchpriority="high" for main images.
- INP (< 200ms): Minimize main thread blocking, use requestIdleCallback for non-critical work.
- CLS (< 0.1): Always reserve space for dynamic content, provide explicit image dimensions.
- Optimization: Use WebP/AVIF formats, implement lazy-loading (loading="lazy"), and code-splitting for large modules.

3. MODERN ARCHITECTURE & TYPE SAFETY:
- Frameworks: Prefer meta-frameworks (Next.js/SvelteKit/Nuxt) and Server Components where applicable.
- TS First: Use strict TypeScript, robust Zod schemas for runtime validation, and clear interface definitions.
- Security: Always validate inputs on server-side, use secure cookies/JWT, and implement proper rate limiting.
- State: Use library-managed server state (React Query) and lightweight client state (Zustand).

-----------------------------------------------
`;
