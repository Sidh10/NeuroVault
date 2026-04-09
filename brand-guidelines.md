# NeuroVault — Brand Guidelines

## Visual identity
- Name: NeuroVault
- Tagline: "You are your nervous system."
- Tone: Clinical precision meets human drama. No startup fluff.

## Color system
- Primary: #7F77DD (purple — trust, intelligence)
- Success / authenticated: #1D9E75 (teal)
- Warning / degrading: #EF9F27 (amber)
- Danger / locked: #E24B4A (red)
- Background: #0A0A0F (near black for dashboard)
- Surface: #13131A
- Text primary: #F0F0F5
- Text secondary: #8888A0

## Typography
- Font: Inter (Google Fonts, free)
- Heading weight: 500
- Monospace for all numbers and scores: JetBrains Mono
- No font smaller than 12px anywhere

## Dashboard UI rules
- Trust Score Ring: SVG arc, 180px diameter, stroke-width 12
- Score number: 48px JetBrains Mono, centered in ring
- Live graph: dark background, two lines — dotted baseline at 85, solid live score
- Session Lock overlay: full viewport, #E24B4A background, white text, centered
- Lock message: "MOTOR MISMATCH DETECTED" — Inter 500, 32px
- Sub-message: the specific SHAP feature that triggered it — 18px

## What NOT to do
- No gradients, no glow effects, no animations except the score ring transition
- No placeholder UI — every element must show real data or a clear loading state
- No lorem ipsum anywhere