export async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  const { extractText: extract } = await import('unpdf');
  const { text } = await extract(new Uint8Array(buffer));
  return Array.isArray(text) ? text.join('\n') : String(text);
}
