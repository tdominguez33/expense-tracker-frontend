export function getContrastColor(hexColor: string): string {
  if (!hexColor) return '#1f2937';
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6 && hex.length !== 3) return '#1f2937';

  const r = parseInt(hex.length === 3 ? hex.charAt(0) + hex.charAt(0) : hex.substring(0, 2), 16);
  const g = parseInt(hex.length === 3 ? hex.charAt(1) + hex.charAt(1) : hex.substring(2, 4), 16);
  const b = parseInt(hex.length === 3 ? hex.charAt(2) + hex.charAt(2) : hex.substring(4, 6), 16);

  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#1f2937' : '#ffffff';
}
