import fs from 'fs/promises';

export async function extractText(filePath: string): Promise<string> {
  const { extractText: extract } = await import('unpdf');
  const dataBuffer = await fs.readFile(filePath);
  const { text } = await extract(new Uint8Array(dataBuffer));
  return Array.isArray(text) ? text.join('\n') : String(text);
}

export async function extractTextByPage(
  filePath: string,
): Promise<Array<{ page: number; text: string }>> {
  const { extractText: extract } = await import('unpdf');
  const dataBuffer = await fs.readFile(filePath);
  const { text } = await extract(new Uint8Array(dataBuffer));
  if (Array.isArray(text)) {
    return text.map((t, i) => ({ page: i + 1, text: t }));
  }
  return [{ page: 1, text: String(text) }];
}
