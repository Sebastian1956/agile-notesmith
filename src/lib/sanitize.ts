/**
 * Sanitize function to clean up AAC excerpt text before processing
 * Removes PDF artifacts, metadata, cross-references, and other unwanted content
 */
export function sanitize(text: string): string {
  let cleaned = text;
  
  // Remove YAML/metadata lines and crumbs
  cleaned = cleaned.replace(/^(section_key|title|chapter|level|word_count|source):\s*.*$/gm, '');
  
  // Remove PDF watermarks/boilerplate
  cleaned = cleaned.replace(/Complimentary Member Copy[.\s]*Not for Distribution or Resale[.\s]*/gi, '');
  cleaned = cleaned.replace(/Not for Distribution or Resale[.\s]*/gi, '');
  
  // Remove cross-references & figure/table labels
  cleaned = cleaned.replace(/\bsee\s+\d+\s*\./gi, '');
  cleaned = cleaned.replace(/\bsee\s+\d+\s*$/gm, '');
  cleaned = cleaned.replace(/\bFigure\s+\d+[:\s]*/gi, '');
  cleaned = cleaned.replace(/^\d+[:\s]+/gm, '');
  cleaned = cleaned.replace(/^###\s*\d+/gm, '');
  
  // Remove Evidence placeholders/quotes
  cleaned = cleaned.replace(/^Evidence:\s*.*$/gm, '');
  cleaned = cleaned.replace(/"Not provided"/gi, '');
  
  // Fix broken tokens/typos
  cleaned = cleaned.replace(/\bam indset\b/gi, 'a mindset');
  cleaned = cleaned.replace(/\binagile\b/gi, 'in agile');
  cleaned = cleaned.replace(/\ba\s+view\b/gi, 'a view');
  cleaned = cleaned.replace(/\ba\s+level\b/gi, 'a level');
  
  // Fix fragmented words (but preserve legitimate single letters like 'a' and 'I')
  cleaned = cleaned.replace(/\b([bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ])\s+([a-z]{2,})\b/g, '$1$2');
  
  // Remove duplicate/stitched fragments - remove sentences that are exact duplicates
  const sentences = cleaned.split(/[.!?]+/);
  const uniqueSentences: string[] = [];
  const seen = new Set<string>();
  
  sentences.forEach(sentence => {
    const trimmed = sentence.trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      uniqueSentences.push(trimmed);
      seen.add(trimmed.toLowerCase());
    }
  });
  
  cleaned = uniqueSentences.join('. ').replace(/\.\s*\./g, '.');
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}