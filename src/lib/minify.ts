import { minify } from 'html-minifier';

export function minifyHTML(html: string): string {
  return minify(html, { collapseWhitespace: true, minifyCSS: true, processConditionalComments: true });
}