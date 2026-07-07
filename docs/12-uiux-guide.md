# Premium UI/UX Design Guide

The bar: feel comparable to a high-end commercial healthcare SaaS (think Linear/Vercel polish applied to a medical product). Reference kits: MedKit Medical SaaS UI, futuristic glassmorphism dashboards, Muzli 2026 dashboard set.

## Design principles

Clarity over decoration · depth via glass + subtle motion (not heavy shadows) · calm clinical confidence · accessible by default · fast-perceived (skeletons + optimistic UI).

## Color palette

- **Base (dark, default):** near-black slate `#0B0F14` → surfaces `#111826` / `#161F2E`; glass = white overlay 6–10% + backdrop-blur.
- **Base (light):** `#F7F9FC` / white surfaces; glass = white 60% + blur.
- **Primary accent — medical teal:** `#14B8A6` (actions, active states).
- **Secondary — indigo:** `#6366F1` (AI/intelligence cues, gradients).
- **Semantic:** success `#22C55E`, warning `#F59E0B`, danger `#EF4444`, info `#3B82F6`.
- **Severity scale:** none→severe = teal → amber → orange → red.
- **Scanner neon:** teal/cyan reticles + indigo sweep on dark; used sparingly, only in the scanner.
- All pairings meet **WCAG AA** (≥4.5:1 text); verified per token.

## Typography

- **UI/body:** Inter (or Geist). **Display/headings:** same family, tight tracking. **Mono:** JetBrains Mono / Geist Mono (scanner status log, metadata, code).
- **Scale (rem):** 0.75 / 0.875 / 1 / 1.125 / 1.25 / 1.5 / 2 / 2.5 / 3. Line-height 1.5 body, 1.2 display.

## Design system & components

- **shadcn/ui** as the ownable base (Radix primitives → accessible). Extend into a `packages/ui` design system.
- Core components: Button, Card/GlassCard, Stat/KPI tile, ConfidenceMeter (radial+bar), SeverityDots, Table (server-paginated), Tabs, Dialog/Sheet, Toast, Skeleton, ProgressRing, HeatmapViewer (opacity slider), ChatPanel, Uploader (dropzone), StatusPill, ScannerHUD (composite).
- **Tokens** (CSS variables) drive light/dark + white-label theming.

## Animation guidelines (Framer Motion)

- Purposeful, 150–300ms, ease-out; spring for playful (reticle lock), tween for content.
- Page/section transitions, list stagger, number count-ups (confidence), scanner sweep/particles.
- **Always** honor `prefers-reduced-motion` → static equivalents. No animation blocks interaction.

## Loading & empty states

- **Skeleton screens** for tables/cards/report (no spinners for layout).
- **Progress** — determinate rings for scans/inference; SSE-driven live status.
- **Optimistic UI** where safe; graceful error + retry states; meaningful empty states with CTA.

## Charts

- **Recharts** (+ visx for bespoke meters). Themed to tokens, dark/light aware.
- Confidence = radial + horizontal bar; class distribution = horizontal bars; analytics = area/line; severity = segmented scale. Follow accessible categorical palette (color + label, never color alone).

## Icons & illustration

- **Lucide** icons (consistent, open-source). Medical glyphs where needed.
- High-quality illustration/empty-state art; subtle gradient meshes for hero/marketing; no clip-art.

## Dashboard layouts

- App shell: left sidebar (collapsible) + top bar (search, theme, org switcher, user). Content = responsive grid of glass cards.
- Analysis pages: image/heatmap left, findings+confidence right, chat docked, report CTA. Report view = letterhead layout.
- Scanner: full-bleed dark stage, HUD overlays, side telemetry rail.

## Accessibility

WCAG 2.1 AA: keyboard-navigable, focus-visible, ARIA on custom widgets, contrast-checked tokens, reduced-motion, screen-reader labels for meters/charts, captions/alt for images, no color-only meaning.

## Responsive behavior

Mobile-first breakpoints (sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536). Sidebar → drawer on mobile; tables → stacked cards; scanner adapts to portrait; report scrolls with sticky actions.

## Deliverable when we build UI

Before coding Phase 2 UI, I can produce **hi-fi Figma mockups** (Figma MCP) or a **clickable HTML prototype Artifact** of the scanner + dashboard for sign-off.

Sources: [MedKit Medical SaaS UI Kit](https://www.figma.com/community/file/1506194098334369354/medkit-medical-saas-dashboard-ui-kit) · [Glass UI (shadcn)](https://allshadcn.com/components/glass-ui/) · [Glassmorphism best practices](https://uxpilot.ai/blogs/glassmorphism-ui) · [2026 dashboard inspiration](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/)
