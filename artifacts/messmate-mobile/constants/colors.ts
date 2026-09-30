/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#293343',
    tint: '#FF7A1A',

    // Core surfaces
    background: '#FFF8F0',
    foreground: '#293343',

    // Cards / elevated surfaces
    card: '#FFFEFC',
    cardForeground: '#293343',

    // Primary action color (buttons, links, active states)
    primary: '#FF7A1A',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#FFF0E1',
    secondaryForeground: '#7A4B2A',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#F5EAE0',
    mutedForeground: '#82776D',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#FFE9D5',
    accentForeground: '#B94C00',

    // Destructive actions (delete, error states)
    destructive: '#EF4444',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#F0E1D2',
    input: '#E9D9C9',
    success: '#22C55E',
    breakfast: '#EAB308',
    lunch: '#FF7A1A',
    dinner: '#6366F1',
    ratingOne: '#FCA5A5',
    ratingTwo: '#FDBA74',
    ratingThree: '#FCD34D',
    ratingFour: '#A3E635',
    ratingFive: '#4ADE80',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 24,
};

export default colors;
