# Nile Brand Customization Plan

## Overview
This document outlines the plan for implementing a custom color scheme and logo integration into the Nile webapp, following shadcn/ui theming best practices.

## Logo Analysis
Based on analysis of `nilelogo.svg`, the key brand colors are:
- **Primary Orange**: `#DB6327` (warm, vibrant accent)
- **Cream/Beige**: `#FBF2E3`, `#F6E5D3`, `#FCEDDC` (light, warm neutrals)
- **Dark**: `#030301`, `#020200` (near-black for text/elements)

---

## Implementation Plan

### 1. Color Theme System (`app/globals.css`)
**Goal**: Replace the current neutral gray palette with warm/earthy tones that match the logo

**Tasks**:
- Convert logo colors to oklch format for modern CSS color management
- Update CSS custom properties in `:root`
- Define primary color as orange (`#DB6327`)
- Use cream tones for backgrounds, cards, and muted elements
- Create complementary secondary and accent colors
- Remove or simplify `.dark` mode (static theme only)
- Ensure all shadcn color tokens are mapped correctly

**File to modify**: `app/globals.css`

---

### 2. Logo Asset Management
**Goal**: Optimize and organize logo files for proper usage across the application

**Tasks**:
- Move `nilelogo.svg` from root to `public/` directory
- Create optimized favicon variants:
  - `favicon.ico` (multi-size)
  - `favicon-16x16.png`
  - `favicon-32x32.png`
  - `apple-touch-icon.png` (180x180)
- Consider creating a simplified icon-only version for small displays
- Ensure SVG is optimized (remove unnecessary metadata)

**New files**:
- `public/nilelogo.svg`
- `public/favicon.ico`
- `public/favicon-16x16.png`
- `public/favicon-32x32.png`
- `public/apple-touch-icon.png`

---

### 3. Reusable Logo Component
**Goal**: Create a flexible, reusable logo component for consistent usage

**Tasks**:
- Create `components/ui/logo.tsx`
- Support size variants: `sm`, `md`, `lg`, `xl`
- Support display modes: `full` (with text) vs `icon` (symbol only)
- Make it responsive and accessible (alt text, aria-labels)
- Export both Logo component and icon-only variant

**New file**: `components/ui/logo.tsx`

**Example API**:
```tsx
<Logo size="md" variant="full" />
<Logo size="sm" variant="icon" className="..." />
```

---

### 4. Header/Navigation Integration
**Goal**: Add logo to all page headers for consistent branding

**Pages to update**:
- `app/admin/dashboard/page.tsx` - Admin header
- `app/professor/request/page.tsx` - Professor header
- `app/page.tsx` - Home/welcome page (featured prominently)
- `app/login/page.tsx` - Login page (if exists, needs verification)

**Pattern**: Replace text-only "Nile" headings with Logo component

---

### 5. Root Layout & Metadata
**Goal**: Update app-wide settings and metadata

**Tasks** in `app/layout.tsx`:
- Add favicon link tags in `<head>`
- Update `metadata.title` from "Create Next App" to "Nile"
- Add `metadata.description` with actual app description
- Add Open Graph metadata for social sharing
- Consider adding theme-color meta tag

**File to modify**: `app/layout.tsx`

---

### 6. Configuration Updates
**Goal**: Update shadcn configuration to reflect custom theme

**Tasks** in `components.json`:
- Update `baseColor` from "neutral" to custom value (or keep neutral and rely on CSS vars)
- Verify all aliases are correct
- Document the custom theme approach

**File to modify**: `components.json`

---

### 7. Testing & Verification
**Goal**: Ensure everything works correctly and is accessible

**Checklist**:
- [ ] All shadcn components render with new colors
- [ ] Logo displays correctly on all pages
- [ ] Favicon appears in browser tabs
- [ ] Color contrast meets WCAG AA standards
- [ ] No broken images or asset paths
- [ ] Mobile/responsive display works
- [ ] Build process succeeds (`npm run build`)

---

## Questions to Answer

### Theme & Color Scheme

1. **Primary Color Usage**
   - Should the orange (`#DB6327`) be used for ALL primary actions (buttons, links, focus states)?
   - Or should it be more selective (only for brand elements, CTAs)?

2. **Background Strategy**
   - Use cream (`#FBF2E3`) as the main page background color?
   - Or keep white backgrounds with cream for cards/sections?
   - What about the current `bg-gradient-to-br from-zinc-50 to-zinc-100` on the home page?

3. **Text & Contrast**
   - Use the logo's dark colors (`#030301`) for all body text?
   - What color for secondary/muted text? (current uses `text-muted-foreground`)
   - How to handle links - orange or underlined dark text?

4. **Interactive States**
   - Hover states: lighten/darken the orange? Use cream overlay?
   - Focus rings: orange or keep neutral gray?
   - Active/pressed states: darker orange or different color?

5. **Destructive Actions**
   - Keep the current red for destructive actions (delete, sign out)?
   - Or use a darker, earthier red that fits the warm palette?

6. **Charts & Data Visualization**
   - The current CSS has 5 chart colors - should these be warm-toned?
   - Or keep them diverse for clarity in data visualization?

### Layout & Structure

7. **Header Design**
   - Should headers have a background color (cream? white?) or stay transparent?
   - Add a subtle border-bottom in orange or keep neutral?
   - Logo alignment: left-aligned with text or centered?

8. **Card Styling**
   - Use cream backgrounds for cards or keep white?
   - Add subtle orange borders or shadows to important cards?
   - Should the admin dashboard stats cards have colored accents?

9. **Spacing & Typography**
   - Keep current spacing or adjust for visual hierarchy?
   - Any custom font pairings? (currently using Geist Sans & Mono)
   - Should headings have the orange color or stay dark?

### Component Customization

10. **Buttons**
    - Primary button: orange background with white text?
    - Secondary button: cream background with dark text?
    - Outline button: orange border with orange text?
    - Ghost/link buttons: how should they look?

11. **Badges**
    - "Admin" badge: orange background?
    - "Authenticated" badge: cream or green?
    - Status badges (pending, approved, etc.): custom colors or semantic defaults?

12. **Tables**
    - Alternate row colors: cream and white striping?
    - Header row: orange background or cream?
    - Hover state: orange tint or neutral?

13. **Forms**
    - Input borders: neutral gray or subtle orange?
    - Focus state: orange ring or keep blue?
    - Labels: all caps, orange color, or standard?

14. **Navigation/Tabs**
    - Active tab: orange underline or background?
    - Tab list background: cream or white?
    - Should there be a persistent sidebar navigation (currently none exists)?

### Logo Implementation

15. **Logo Sizing**
    - Header logo height: 32px, 40px, 48px?
    - Home page featured logo: how large?
    - Should logo scale down on mobile or stay fixed size?

16. **Logo Variants**
    - Do you have or need a horizontal version (logo + "Nile" text)?
    - Icon-only for mobile/small spaces?
    - Inverted/white version for dark backgrounds (if needed)?

17. **Logo Animation**
    - Any subtle animations on hover/load?
    - Loading spinner could incorporate the logo shape?

### Responsive & Accessibility

18. **Mobile Considerations**
    - Simplify header on mobile (icon-only logo)?
    - Touch targets - should buttons be larger?
    - Mobile menu pattern (if needed in future)?

19. **Accessibility**
    - Are all color contrasts sufficient for WCAG AA?
    - Should there be a high-contrast mode toggle?
    - Focus indicators: make them more prominent?

20. **Dark Mode Future**
    - You mentioned "no light/dark theme just static" - which one?
    - Light mode with warm colors, or dark mode with warm colors?
    - Should we remove dark mode CSS entirely or leave it for future?

### Additional Features

21. **Loading States**
    - Custom loading spinner with logo animation?
    - Skeleton screens: use cream color instead of gray?
    - Progress bars: orange fill?

22. **Alerts & Notifications**
    - Toast notifications (using Sonner): custom styling?
    - Alert colors: warm-toned variants or keep semantic (red=error, etc.)?

23. **Special Components**
    - The ISBN scanner - any special branding treatment?
    - File upload areas - custom styling?
    - Empty states - feature logo or illustration?

24. **Consistency**
    - Should ALL pages follow the same header pattern?
    - Different layouts for admin vs professor vs public pages?

---

## Next Steps

1. **Answer the questions above** to finalize design decisions
2. **Review and approve** the implementation plan
3. **Execute** the implementation in order (theme → assets → components → pages)
4. **Test** thoroughly across different pages and states
5. **Document** the custom theme for future developers

---

## Resources

- [shadcn/ui Theming Documentation](https://ui.shadcn.com/docs/theming)
- Current project files:
  - `app/globals.css` - Color system
  - `components.json` - shadcn config
  - `nilelogo.svg` - Brand logo (451KB SVG)
  - Page components in `app/` directory
  - UI components in `components/ui/`
