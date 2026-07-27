export const HERO_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const HERO_IMAGE_MIN_WIDTH = 1400;
export const HERO_IMAGE_MIN_HEIGHT = 600;
export const HERO_IMAGE_MIN_ASPECT = 1.8;
export const HERO_IMAGE_MAX_ASPECT = 3;
export const HERO_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export function validateHeroFileMetadata(input: {
  name: string;
  type: string;
  size: number;
}): { valid: true } | { valid: false; message: string } {
  if (!input.name || input.size <= 0) {
    return { valid: false, message: "Choose a non-empty image file." };
  }
  if (
    !HERO_IMAGE_TYPES.includes(
      input.type as (typeof HERO_IMAGE_TYPES)[number],
    )
  ) {
    return { valid: false, message: "Use a PNG, JPEG, or WebP image." };
  }
  if (input.size > HERO_IMAGE_MAX_BYTES) {
    return { valid: false, message: "The banner must be 15 MB or smaller." };
  }
  return { valid: true };
}

export function validateHeroDimensions(
  width: number,
  height: number,
): { valid: true } | { valid: false; message: string } {
  if (width < HERO_IMAGE_MIN_WIDTH || height < HERO_IMAGE_MIN_HEIGHT) {
    return {
      valid: false,
      message: `Use an image at least ${HERO_IMAGE_MIN_WIDTH} × ${HERO_IMAGE_MIN_HEIGHT} pixels.`,
    };
  }
  const aspect = width / height;
  if (aspect < HERO_IMAGE_MIN_ASPECT || aspect > HERO_IMAGE_MAX_ASPECT) {
    return {
      valid: false,
      message: "Use a wide image with an aspect ratio between 1.8:1 and 3:1.",
    };
  }
  return { valid: true };
}
