export async function copyToClipboard(text: string): Promise<void> {
  const { default: clipboardy } = await import('clipboardy');
  await clipboardy.write(text);
}
