/**
 * @module pdf
 * Utility for extracting plain text from PDF file buffers using unpdf.
 */

/**
 * Extract all text content from a PDF provided as a Node.js Buffer.
 *
 * Uses the `unpdf` library to parse the PDF and concatenates all text pages
 * into a single newline-separated string.
 *
 * @param buffer - The raw binary content of a PDF file.
 * @returns A promise resolving to the full extracted text of the PDF.
 */
export async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  const { extractText: extract } = await import('unpdf');
  const { text } = await extract(new Uint8Array(buffer));
  return Array.isArray(text) ? text.join('\n') : String(text);
}
