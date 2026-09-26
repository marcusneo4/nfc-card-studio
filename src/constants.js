/** CR80 card width in millimeters. */
export const CARD_WIDTH_MM = 85.6;

/** ISO/IEC 7810 ID-1 card height in millimeters. */
export const CARD_HEIGHT_MM = 53.98;

/** Print resolution used for the internal canvas and PNG pHYs chunk. */
export const PRINT_DPI = 300;

/** Internal canvas width in pixels at {@link PRINT_DPI}. */
export const CARD_WIDTH = 1011;

/** Internal canvas height in pixels at {@link PRINT_DPI}. */
export const CARD_HEIGHT = 638;

/** Unprinted inset, in millimeters, drawn as an HTML guide only. */
export const SAFE_MARGIN_MM = 3;

/** Safe-zone inset in canvas pixels. */
export const SAFE_INSET_PX = (SAFE_MARGIN_MM / 25.4) * PRINT_DPI;

/** Smallest QR that stays scannable on a printed CR80 card. */
export const MIN_QR_MM = 15;

/** {@link MIN_QR_MM} converted to canvas pixels at {@link PRINT_DPI}. */
export const MIN_QR_PX = (MIN_QR_MM / 25.4) * PRINT_DPI;

/** Paper color for an empty card face. Not pure white. */
export const CARD_BACKGROUND = '#f3efe6';

/** Pixels per meter written into the PNG pHYs chunk for 300 DPI. */
export const PIXELS_PER_METER = Math.round(PRINT_DPI / 0.0254);

/** User zoom is a multiplier on the fit-to-viewport scale. Below 1 zooms the card out. */
export const MIN_USER_ZOOM = 0.35;

/** Upper bound so a pinch cannot scale the stage without limit. */
export const MAX_USER_ZOOM = 4;

/** Photo-fill zoom relative to a cover fit. Below 1 reveals more of the photo. */
export const MIN_FILL_ZOOM = 0.5;

/** Upper bound for photo-fill zoom so a background cannot grow without limit. */
export const MAX_FILL_ZOOM = 3;

/** Selected-image zoom as a fraction of the source size. */
export const MIN_IMAGE_ZOOM = 0.1;

/** Upper bound for selected-image zoom. */
export const MAX_IMAGE_ZOOM = 4;
