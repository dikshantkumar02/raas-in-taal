import QRCode from 'qrcode';

/**
 * Generates an SVG or PNG Data URL for a given string token.
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320,
      color: {
        dark: '#1A0307', // Dark maroon dots
        light: '#FFFFFF', // Crisp white background
      },
    });
  } catch (err) {
    throw new Error('Failed to generate QR code');
  }
}
