import fs from 'fs/promises';
import pdf from 'pdf-parse';

export async function extractText(filePath: string): Promise<string> {
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
}

export async function extractTextByPage(
  filePath: string
): Promise<Array<{ page: number; text: string }>> {
  const dataBuffer = await fs.readFile(filePath);
  const pages: Array<{ page: number; text: string }> = [];

  await pdf(dataBuffer, {
    pagerender: (pageData: any) => {
      return pageData.getTextContent().then((textContent: any) => {
        const text = textContent.items.map((item: any) => item.str).join(' ');
        pages.push({ page: pageData.pageIndex + 1, text });
        return text;
      });
    },
  });

  return pages;
}
