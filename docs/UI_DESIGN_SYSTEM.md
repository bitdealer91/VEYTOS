# VEYTOS visual system

VEYTOS — The home of Aptos NFTs.

An editorial marketplace: artwork first, compact market rows, generous section
spacing and quiet surfaces. Graphite backgrounds, warm ivory text and vermilion
calls to action form our identity. Unavailable artwork uses a labelled geometric
fallback, never unrelated illustrations pretending to be NFT media.

Canonical tokens live in apps/web/src/app/globals.css and Tailwind's theme.
Background #111214; surface #191a1d; elevated #222327; hover #292a2e;
border #303137; hover border #52535b. Text #f3f1eb, secondary #b7b7bf, muted #909199.
Accent #ff745e with dark ink, success #a9d8bb, warning #e8c27a, error #ff9898.
Semantic labels accompany all status colors. Focus outlines use the accent.

Typography: locally bundled Geist sans with system fallbacks; tabular numbers for
prices/counts. Display is tight and confident, body text is readable and unadorned.
Sizes: 12/14/16/20/28/40/56px; normal body line-height 1.55.
Spacing scale: 4/8/12/16/24/32/48/64px. Container max 1440px, responsive gutters.
Radii: 6px controls, 12px panels, 20px feature surfaces; rounded pills only for status.
Shadows only for floating dialogs. Transitions 140/220ms; reduced-motion respected.

Cards use dominant artwork, small native-asset context and a precise price/status.
Tables use understated row dividers and right-aligned numeric columns. No fake floor,
volume, owners, verification badges or social links. Empty, error, loading and
metadata-unavailable states are deliberate parts of the design system.

Primary components: AppHeader, SearchBar, WalletButton, NetworkBadge, Artwork,
CollectionCard/DropCard, NFTCard, WalletAddress, PriceDisplay, StatBlock,
SectionHeader, EmptyState, ErrorState, SkeletonCard, MintProgress,
QuantitySelector and TransactionStatus. Native dialogs provide focus containment,
Escape handling and return focus; every interactive element has a visible focus state.

Validate 375, 430, 768, 1024, 1440 and 1920px. Navigation and filters wrap intentionally;
collection mint panel becomes a full-width section on mobile with a sticky jump CTA.
No horizontal page overflow is acceptable.
