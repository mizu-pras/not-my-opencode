import { describe, expect, test } from 'bun:test';
import {
  extractFromHtml,
  extractHeadingsFromMarkdown,
  joinRenderedContent,
} from './utils';

describe('smartfetch/utils', () => {
  test('extracts cleaned headings from markdown', () => {
    const headings = extractHeadingsFromMarkdown(
      ['# Intro', '## Details ###', '### C#', 'plain text'].join('\n'),
    );

    expect(headings).toEqual(['Intro', 'Details', 'C#']);
  });

  test('injects metadata comments after an XML declaration in html output', () => {
    const result = joinRenderedContent(
      '---\nsource: "smartfetch"\n---\n\n',
      '<?xml version="1.0"?><root>ok</root>',
      'html',
    );

    expect(result).toStartWith('<?xml version="1.0"?>');
    expect(result).toContain('<!--\n---\nsource: "smartfetch"\n---\n-->');
    expect(result).toContain('<root>ok</root>');
  });

  test('extracts main HTML content with Defuddle before fallback extraction', async () => {
    const html = `<!doctype html>
      <html>
        <head><title>Example Page</title></head>
        <body>
          <nav>Navigation noise</nav>
          <main>
            <article>
              <h1>Important Article</h1>
              <p>This is the useful article content for agents.</p>
            </article>
          </main>
          <footer>Footer noise</footer>
        </body>
      </html>`;

    const result = await extractFromHtml(
      html,
      'https://example.com/post',
      true,
    );

    expect(result.extractedMain).toBe(true);
    expect(result.title).toBe('Example Page');
    expect(result.markdown).toContain('Important Article');
    expect(result.markdown).toContain('useful article content');
    expect(result.markdown).not.toContain('Navigation noise');
    expect(result.markdown).not.toContain('Footer noise');
  });
});
