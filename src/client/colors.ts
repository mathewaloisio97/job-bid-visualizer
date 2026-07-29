/**
 * @fileoverview Deterministic color assignment service for vendors and entities.
 * Features a high-contrast 20-color distinct palette optimized for chart UI readability
 * and uses string hashing for state-independent color assignments.
 *
 * @module Colors
 */

/**
 * 20-color distinct palette selected for high perceptual variance on light UI canvases.
 * Curated using distinct hue steps across red, orange, yellow, green, cyan, blue, purple, and magenta.
 */
const VENDOR_PALETTE: readonly string[] = [
  '#4f46e5', // Indigo
  '#059669', // Emerald
  '#dc2626', // Red
  '#0284c7', // Sky Blue
  '#d97706', // Amber
  '#7c3aed', // Violet
  '#db2777', // Pink
  '#0d9488', // Teal
  '#ca8a04', // Yellow / Gold
  '#e11d48', // Rose
  '#2563eb', // Blue
  '#16a34a', // Green
  '#9333ea', // Purple
  '#ea580c', // Orange
  '#0891b2', // Cyan
  '#c026d3', // Fuchsia
  '#4d7c0f', // Lime / Olive
  '#be123c', // Crimson
  '#4338ca', // Deep Indigo
  '#475569', // Slate
] as const;

/**
 * In-memory map caching assigned vendor colors to avoid redundant hash computations.
 */
const vendorColorCache: Record<string, string> = {};

/**
 * Computes a 32-bit FNV-1a hash from a given string.
 *
 * @param str - Input string to hash.
 * @returns 32-bit unsigned integer hash value.
 */
function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // Multiply by 32-bit FNV prime (16777619) using 32-bit integer arithmetic
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Retrieves a deterministic color hex code for a vendor name.
 * Utilizes FNV-1a hashing so identical vendor names always resolve to the same palette color
 * independent of ingestion order or filter state.
 *
 * @param vendorName - Display name or identifier of the vendor.
 * @returns Hex color string from VENDOR_PALETTE.
 */
export function getVendorColor(vendorName: string): string {
  if (!vendorName) return VENDOR_PALETTE[0];

  const normalizedKey = vendorName.trim().toLowerCase();

  if (!vendorColorCache[normalizedKey]) {
    const hash = hashString(normalizedKey);
    const paletteIndex = hash % VENDOR_PALETTE.length;
    vendorColorCache[normalizedKey] = VENDOR_PALETTE[paletteIndex];
  }

  return vendorColorCache[normalizedKey];
}
