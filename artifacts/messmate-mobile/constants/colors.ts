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
    text: '#000000',
    tint: '#F06A14',

    // Core surfaces
    background: '#F1ECEC',
    foreground: '#000000',

    // Cards / elevated surfaces
    card: '#FCFCFC',
    cardForeground: '#000000',

    // Primary action color (buttons, links, active states)
    primary: '#F06A14',
    primaryForeground: '#ffffff',
    primaryPressed: '#D9570A',
    veg: '#118A1A',
    nonVeg: '#D9151B',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#F7DED0',
    secondaryForeground: '#000000',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#E9E1DF',
    mutedForeground: '#645D5D',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#F9D9C4',
    accentForeground: '#9F3900',

    // Destructive actions (delete, error states)
    destructive: '#D9151B',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#000000',
    input: '#968C8A',
    success: '#118A1A',
    breakfast: '#EAB308',
    lunch: '#F06A14',
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
