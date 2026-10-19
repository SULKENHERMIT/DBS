---
name: Precision Portfolio
colors:
  surface: '#f9f9fb'
  surface-dim: '#d9dadc'
  surface-bright: '#f9f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f5'
  surface-container: '#eeeef0'
  surface-container-high: '#e8e8ea'
  surface-container-highest: '#e2e2e4'
  on-surface: '#1a1c1d'
  on-surface-variant: '#414755'
  inverse-surface: '#2f3132'
  inverse-on-surface: '#f0f0f2'
  outline: '#717786'
  outline-variant: '#c1c6d7'
  surface-tint: '#005bc1'
  primary: '#0058bc'
  on-primary: '#ffffff'
  primary-container: '#0070eb'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#5f5e60'
  on-secondary: '#ffffff'
  secondary-container: '#e1dfe1'
  on-secondary-container: '#636264'
  tertiary: '#9e3d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c64f00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004493'
  secondary-fixed: '#e4e2e4'
  secondary-fixed-dim: '#c8c6c8'
  on-secondary-fixed: '#1b1b1d'
  on-secondary-fixed-variant: '#474649'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb595'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7c2e00'
  background: '#f9f9fb'
  on-background: '#1a1c1d'
  surface-variant: '#e2e2e4'
typography:
  display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  title:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  data-lg:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
  data-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  data-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin: 24px
---

## Brand & Style
The design system is centered on a **Corporate Modern** aesthetic inspired by macOS desktop utilities. It prioritizes clarity, high information density, and functional confidence. The target audience includes institutional and retail investors who require a reliable, distraction-free environment for financial analysis. 

The visual language avoids trends like glassmorphism or heavy gradients, opting instead for a "Native App" feel characterized by flat surfaces, structural hierarchy, and meticulous alignment. The interface should feel like a precise instrument: sturdy, responsive, and predictable.

## Colors
The palette is divided into structural neutrals and functional accents.

- **Primary Blue:** Used exclusively for primary actions, active states, and selection indicators. 
- **Neutrals:** Light mode uses a soft off-white (`#F5F5F7`) for backgrounds to reduce eye strain compared to pure white. Dark mode utilizes a deep charcoal (`#1E1E1E`) background with slightly lighter (`#2C2C2E`) surfaces for container elevation.
- **Semantic Financials:** Green and Red are strictly reserved for market data (gain/loss). They must not be used for general UI feedback (like "Success" messages) unless they represent financial growth. Use the Primary Blue for standard system confirmations.

## Typography
This design system employs a dual-font strategy to maximize legibility of complex datasets.

1.  **UI Text (Inter):** Used for all navigation, headers, and descriptive text. It provides a neutral, highly readable sans-serif foundation.
2.  **Financial Data (JetBrains Mono):** All currency values, percentages, tickers, and numerical tables must use this monospaced font. This ensures decimal points and digits align vertically in tables, facilitating rapid comparison of figures.

Use `data-md` for standard table cells and `display` for primary portfolio balances.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid** model. Sidebars and utility panels use fixed widths (e.g., 240px), while the main content area is a fluid 12-column grid.

- **Density:** High density is preferred for data tables. Row heights should be kept at a compact 32px or 40px to maximize information visibility without scrolling.
- **Margins:** Standard 24px outer margins for views, with 16px gutters between modular cards.
- **Responsive:** On mobile, sidebars collapse into a bottom navigation bar or a "drawer" menu. Cards stack vertically, and complex tables transition to a "Key-Value" list format.

## Elevation & Depth
Depth is communicated through **Tonal Layering** and subtle, crisp shadows. 

- **Level 0 (Background):** The base canvas (`#F5F5F7` or `#1E1E1E`).
- **Level 1 (Cards/Surfaces):** Raised surfaces using `#FFFFFF` (Light) or `#2C2C2E` (Dark). These feature a 1px subtle border (`#E5E5E7` or `#3A3A3C`) and a `shadow-sm` (4px blur, 5% opacity black).
- **Level 2 (Popovers/Modals):** Elements that sit above the main UI. These use a `shadow-md` (12px blur, 10% opacity black) and a more pronounced 1px border to differentiate from underlying cards.

Avoid all use of background blurs (glassmorphism) to maintain the clean, "opaque" utility aesthetic.

## Shapes
The shape language is sophisticated and rounded, softening the "hard" data within.

- **Primary Containers:** Large portfolio cards and main dashboard widgets use a 1rem (`rounded-2xl`) corner radius.
- **Interactive Elements:** Buttons and secondary controls use 0.5rem (`rounded-lg`) for a balanced, modern feel.
- **Form Fields:** Inputs use a tighter 0.375rem (`rounded-md`) to maintain a sense of precision and structure in dense forms.

## Components
- **Buttons:** Primary buttons use the Accent Blue with white text. Secondary buttons use a subtle tonal fill (light gray or charcoal) with no border. Text is always centered.
- **Financial Tables:** Headers are `body-sm` in all-caps with subtle tracking. Alternate rows can use a very faint tint for "zebra-striping" in high-density views. Align numerical data to the right; align text to the left.
- **Cards:** Cards should have a 1px internal padding for a "Border-Box" feel. Use them to group related metrics (e.g., "Performance Over Time").
- **Inputs:** Use a 1px solid border. When focused, the border color changes to Primary Blue and gains a subtle 2px blue "outer-glow" (0.2 alpha) to mimic macOS focus states.
- **Chips/Badges:** Used for asset classes (e.g., "Equity", "Crypto"). These should use neutral fills. Only use green/red badges for "Profit/Loss" status indicators.
- **Status Indicators:** Use small 8px circular dots to indicate connection status or market open/close, following standard semantic coloring.