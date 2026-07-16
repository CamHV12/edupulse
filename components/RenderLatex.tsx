import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { formatTextWithMath } from '../utils/mathFormatter';

interface RenderLatexProps {
  content?: string | null;
}

// Render mixed content containing plain text, math expressions, and LaTeX segments.
// Supports inline `$...$`, display `$$...$$`, `\(...\)` and `\[...\]`.
export function RenderLatex({ content }: RenderLatexProps) {
  if (!content) return <span />;
  const s = String(content);

  // If the content already contains HTML tags and no LaTeX delimiters, render as-is.
  if (s.includes('<') && !s.includes('$') && !s.includes('\\(') && !s.includes('\\[')) {
    return <span dangerouslySetInnerHTML={{ __html: s }} />;
  }

  const escapeHtml = (raw: string) => raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const parts = s.split(/(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$|\\\\\([\s\S]+?\\\\\)|\\\\\[[\s\S]+?\\\\\])/g);
  const html = parts.map((part) => {
    if (!part) return '';
    // $$...$$
    if (/^\$\$[\s\S]+\$\$$/.test(part)) {
      const inner = part.slice(2, -2);
      try { return katex.renderToString(inner, { throwOnError: false, displayMode: true }); } catch { return escapeHtml(part); }
    }
    // $...$
    if (/^\$[\s\S]+\$$/.test(part)) {
      const inner = part.slice(1, -1);
      try { return katex.renderToString(inner, { throwOnError: false, displayMode: false }); } catch { return escapeHtml(part); }
    }
    // \(...\)
    if (/^\\\\\([\s\S]+\\\\\)$/.test(part)) {
      const inner = part.slice(2, -2);
      try { return katex.renderToString(inner, { throwOnError: false, displayMode: false }); } catch { return escapeHtml(part); }
    }
    // \[...\]
    if (/^\\\\\[[\s\S]+\\\\\]$/.test(part)) {
      const inner = part.slice(2, -2);
      try { return katex.renderToString(inner, { throwOnError: false, displayMode: true }); } catch { return escapeHtml(part); }
    }
    
    // For plain text segments, apply math formatting (using mathjs/regex mapping) first, then escape HTML
    return escapeHtml(formatTextWithMath(part));
  }).join('');

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default RenderLatex;
