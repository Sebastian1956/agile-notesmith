import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, FileText, Sparkles, ShieldCheck, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sanitize } from "@/lib/sanitize";

interface TakeawaySuggestion {
  sentence: string;
  score: number;
  selected: boolean;
}

interface CornellNote {
  title: string;
  date: string;
  module: string;
  keywords: string[];
  questions: Array<{ question: string; answer: string; evidence?: string; needsReview?: boolean }>;
  takeaways: string[];
  summary: string;
  isValid?: boolean;
  validationErrors?: string[];
}

const SYSTEM_PROMPT = `You generate **AAC exam study notes** from Agile Extension v2 excerpts.

Your job is to 1) **sanitize** the excerpt (remove junk/metadata), and 2) produce **integrated, exam-ready notes** in clean Markdown. Never echo or describe these rules in the output.

========================
DEFAULT COUNTS & LAYOUT
========================
- Keep the same Cornell sections:
  1) **Keywords** (5–7)
  2) **Questions & Answers** (5 items)
  3) **Takeaways** (5–7)
  4) **Summary** (one paragraph, 4–6 sentences)

=================
SANITIZE THE INPUT
=================
Before writing, remove or correct ALL of the following if present in the excerpt. Do not mention this process in the output.

1) **YAML / metadata lines** and crumbs:
   - Lines starting with or containing: \`section_key:\`, \`title:\`, \`chapter:\`, \`level:\`, \`word_count:\`, \`source:\`.
2) **PDF watermarks / boilerplate**:
   - Phrases like: \`Complimentary Member Copy\`, \`Not for Distribution or Resale\`.
3) **Cross-references & figure/table labels**:
   - Patterns like \`see 4 .\`, \`see 5 .\`, \`Figure 1\`, \`1:\`, \`### 3\`, or stray leading numbers before sentences.
4) **Evidence placeholders / quotes**:
   - Any \`Evidence:\` lines, \`"Not provided"\`, or raw pull-quotes.
5) **Broken tokens / typos** (fix obvious ones):
   - \`am indset\` → \`a mindset\`; \`inagile\` → \`in agile\`; spacing issues like \`a view\`, \`a level\`.
6) **Duplicate or stitched fragments**:
   - Remove repeated sentences/clauses; combine fragments into complete sentences.
7) **Whitespace normalization**:
   - Collapse multiple spaces/newlines; output clean Markdown only.

==============
CONTENT RULES
==============
A) **Tone & framing**
- Integrated, concise, and exam-oriented.
- Use consistent AAC vocabulary:
  - "Agile is a **mindset expressed via context-appropriate practices**."
  - "AE v2 **maps mindset-led BA practices to BABOK v3** (no fixed checklist)."
  - "Rolling-wave / progressive elaboration" for multi-horizon planning.
  - "Three Horizons = Strategy, Initiative, Delivery (SID)."

B) **Keywords (5–7)**
- Only exam-critical terms; no filler, no numbering, no framework brand lists unless directly relevant.

C) **Questions & Answers**
- Exactly 5 (or N if requested). Bold the question label.
- Each answer is **2–3 crisp, integrated sentences** (no fragments, no metadata).
- Do **NOT** include "Evidence" lines. If the UI requires \`<details>\`, include **only** the paragraph answer inside \`<details>\`.

D) **Takeaways (5–7)**
- Full sentences (not fragments).
- Emphasize **relationships and distinctions** (e.g., mindset ↔ practices; SID ↔ feedback; predictive vs iterative vs adaptive).
- No repetition across bullets.

E) **Summary (4–6 sentences)**
- One flowing paragraph, written as a **memory aid**.
- Natural order when relevant: **purpose → horizons/rolling-wave → mindset vs practices → scope → business value**.
- No citations, figures, or cross-refs.

==================
STRUCTURE & FORMAT
==================
Output **clean Markdown** only, in this order and with these headings:
- \`## Keywords\` as a bulleted list (\`- term\`)
- \`## Questions & Answers\` with 5 items:
  - \`- **Q1:** <question>\`
    - \`Answer:\` <one paragraph, 2–3 sentences>
  (If the app enforces \`<details>\`, wrap ONLY the answer paragraph in \`<details>\`.)
- \`## Takeaways\` as 5–7 bullets, each a complete sentence.
- \`## Summary\` as one paragraph (4–6 sentences).`;

export function CornellNoteGenerator() {
  const [excerpt, setExcerpt] = useState("");
  const [cornellNote, setCornellNote] = useState<CornellNote | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [strictMode, setStrictMode] = useState(false);
  const [suggestedTakeaways, setSuggestedTakeaways] = useState<TakeawaySuggestion[]>([]);
  const [selectedTakeaways, setSelectedTakeaways] = useState<string[]>([]);
  const [domainVocabulary, setDomainVocabulary] = useState("");
  const { toast } = useToast();

  // Filter out questions and transform them into declarative statements for Cornell Notes
  const filterQuestionTakeaways = (sentence: string): { isValid: boolean; transformed?: string } => {
    const trimmed = sentence.trim();
    
    // Check if it's a question (ends with ? or starts with question words)
    const questionPatterns = [
      /\?$/,
      /^(what|how|why|when|where|who|which|can|could|would|should|will|do|does|did|is|are|was|were)\s/i
    ];
    
    const isQuestion = questionPatterns.some(pattern => pattern.test(trimmed));
    
    if (!isQuestion) {
      return { isValid: true };
    }
    
    // Try to transform common question patterns into declarative statements
    let transformed = trimmed;
    
    // Transform "What is X?" to "X is defined as..." (but skip if we can't reasonably transform)
    if (/^what\s+is\s+(.+?)\?$/i.test(trimmed)) {
      const match = trimmed.match(/^what\s+is\s+(.+?)\?$/i);
      if (match && match[1]) {
        // Only transform if the rest of the sentence provides context
        return { isValid: false }; // Skip these for now as they need more context
      }
    }
    
    // Transform "How does X work?" style questions (skip these as they're typically not good takeaways)
    if (/^(how|why|when|where)\s/i.test(trimmed)) {
      return { isValid: false };
    }
    
    // For other question patterns, just filter them out
    return { isValid: false };
  };

  // Extract takeaway suggestions using domain-neutral scoring heuristic
  const extractTakeawaySuggestions = (text: string, keywords: string[]): TakeawaySuggestion[] => {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 15);
    const suggestions: TakeawaySuggestion[] = [];
    const usedSentences = new Set<string>();

    // Domain vocabulary terms (optional user input)
    const domainTerms = domainVocabulary.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
    
    // Auto-extract concept terms (capitalized noun phrases, frequent bigrams)
    const conceptTerms = extractConceptTerms(text);

    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      const lowerSentence = trimmed.toLowerCase();
      
      // Skip if already used or too short/long
      if (usedSentences.has(trimmed) || trimmed.length < 20 || trimmed.length > 200) return;

      let score = 0;
      const wordCount = trimmed.split(/\s+/).length;

      // +3 for sentences beginning with specific patterns
      const starterPatterns = [
        /^(it|this|the)\s+(is|introduces|describes|defines|explains|emphasizes|recommends|provides|demonstrates|enables|results in)/i
      ];
      if (starterPatterns.some(pattern => pattern.test(trimmed))) {
        score += 3;
      }

      // +2 for generic action verbs
      const actionVerbs = ['introduces', 'describes', 'explains', 'defines', 'emphasizes', 'recommends', 'provides', 'demonstrates', 'enables', 'results'];
      if (actionVerbs.some(verb => lowerSentence.includes(verb))) {
        score += 2;
      }

      // +1 for each keyword match
      keywords.forEach(keyword => {
        if (lowerSentence.includes(keyword.toLowerCase())) {
          score += 1;
        }
      });

      // +1 for each concept term match
      conceptTerms.forEach(term => {
        if (lowerSentence.includes(term.toLowerCase())) {
          score += 1;
        }
      });

      // +1 for each domain vocabulary match
      domainTerms.forEach(term => {
        if (lowerSentence.includes(term)) {
          score += 1;
        }
      });

      // +1 if sentence length is 8-28 words
      if (wordCount >= 8 && wordCount <= 28) {
        score += 1;
      }

      // Add to suggestions if score > 0 and it's not a question
      if (score > 0) {
        const filterResult = filterQuestionTakeaways(trimmed);
        if (filterResult.isValid) {
          const finalSentence = filterResult.transformed || trimmed;
          suggestions.push({
            sentence: finalSentence,
            score,
            selected: false
          });
          usedSentences.add(finalSentence);
        }
      }
    });

    // Remove near-duplicates (-2 penalty)
    const filteredSuggestions = removeDuplicates(suggestions);

    // Sort by score (descending) and return top 8-12
    return filteredSuggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  };

  // Extract concept terms from text
  const extractConceptTerms = (text: string): string[] => {
    const concepts: string[] = [];
    
    // Capitalized noun phrases
    const capitalizedPhrases = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    concepts.push(...capitalizedPhrases.filter(p => p.length > 3));

    // Frequent bigrams
    const words = text.toLowerCase().split(/\s+/);
    const bigramCounts: { [key: string]: number } = {};
    
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (bigram.length > 6 && !bigram.includes('the') && !bigram.includes('and')) {
        bigramCounts[bigram] = (bigramCounts[bigram] || 0) + 1;
      }
    }

    const frequentBigrams = Object.entries(bigramCounts)
      .filter(([, count]) => count >= 2)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([bigram]) => bigram);

    concepts.push(...frequentBigrams);
    
    return [...new Set(concepts)];
  };

  // Remove near-duplicate suggestions
  const removeDuplicates = (suggestions: TakeawaySuggestion[]): TakeawaySuggestion[] => {
    const filtered: TakeawaySuggestion[] = [];
    
    suggestions.forEach(suggestion => {
      const isDuplicate = filtered.some(existing => {
        const similarity = calculateSimilarity(suggestion.sentence, existing.sentence);
        return similarity > 0.7; // 70% similarity threshold
      });
      
      if (!isDuplicate) {
        filtered.push(suggestion);
      } else {
        // Apply -2 penalty for near-duplicates
        suggestion.score = Math.max(0, suggestion.score - 2);
        if (suggestion.score > 0) {
          filtered.push(suggestion);
        }
      }
    });
    
    return filtered;
  };

  // Simple similarity calculation
  const calculateSimilarity = (str1: string, str2: string): number => {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    const intersection = words1.filter(word => words2.includes(word)).length;
    const union = new Set([...words1, ...words2]).size;
    return intersection / union;
  };

  // Handle takeaway suggestion selection
  const handleTakeawaySelection = (sentence: string, selected: boolean) => {
    setSuggestedTakeaways(prev => 
      prev.map(suggestion => 
        suggestion.sentence === sentence 
          ? { ...suggestion, selected }
          : suggestion
      )
    );

    if (selected) {
      setSelectedTakeaways(prev => 
        prev.includes(sentence) ? prev : [...prev, sentence]
      );
    } else {
      setSelectedTakeaways(prev => prev.filter(s => s !== sentence));
    }
  };

  // Cleanup function to fix fragmented words and normalize whitespace
  const cleanupText = (text: string): string => {
    let cleaned = text;
    
    // Fix fragmented words more comprehensively
    // Pattern 1: Single letter + space + lowercase word (fragmented words)
    // But avoid joining if the single letter could be a legitimate word (A, I)
    // and avoid joining if what follows starts with a capital (separate word)
    cleaned = cleaned.replace(/\b([a-z])\s+([a-z][a-z]+)\b/g, (match, letter, rest) => {
      // Don't join common single-letter words that should stay separate
      if (['a', 'i'].includes(letter.toLowerCase())) {
        return match; // Keep original
      }
      return letter + rest;
    });
    
    // Pattern 2: Fix common fragmented words specifically
    const fragmentPatterns: Array<[RegExp, string]> = [
      // Common small words
      [/\bo\s+f\b/gi, 'of'],
      [/\ba\s+nd\b/gi, 'and'],
      [/\bt\s+he\b/gi, 'the'],
      [/\bt\s+o\b/gi, 'to'],
      [/\bi\s+n\b/gi, 'in'],
      [/\bi\s+s\b/gi, 'is'],
      [/\bo\s+r\b/gi, 'or'],
      [/\bf\s+or\b/gi, 'for'],
      [/\bb\s+y\b/gi, 'by'],
      [/\ba\s+t\b/gi, 'at'],
      [/\bo\s+n\b/gi, 'on'],
      [/\bu\s+p\b/gi, 'up'],
      
      // Common longer words that get fragmented
      [/\be\s+ach\b/gi, 'each'],
      [/\bu\s+sed\b/gi, 'used'],
      [/\bt\s+echniques?\b/gi, 'technique'],
      [/\bp\s+ractices?\b/gi, 'practice'],
      [/\bh\s+orizon\b/gi, 'horizon'],
      [/\bb\s+usiness\b/gi, 'business'],
      [/\ba\s+nalysis\b/gi, 'analysis'],
      [/\bc\s+ontext\b/gi, 'context'],
      [/\bp\s+rocess\b/gi, 'process'],
      [/\br\s+equirement\b/gi, 'requirement'],
      [/\bs\s+takeholder\b/gi, 'stakeholder'],
      [/\bp\s+roject\b/gi, 'project'],
      [/\bm\s+anager\b/gi, 'manager'],
      [/\bd\s+evelop\b/gi, 'develop'],
      [/\bv\s+alue\b/gi, 'value'],
      [/\bd\s+etail\b/gi, 'detail'],
    ];
    
    // Apply specific pattern fixes
    fragmentPatterns.forEach(([pattern, replacement]) => {
      cleaned = cleaned.replace(pattern, replacement);
    });
    
    // Normalize multiple spaces to single space
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Clean up extra whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
  };

  const generateCornellNote = async () => {
    if (!excerpt.trim()) {
      toast({
        title: "No excerpt provided",
        description: "Please paste an excerpt from the Agile Extension v2 to generate notes.",
        variant: "destructive",
      });
      return;
    }

    // Clean up and sanitize the excerpt
    const sanitizedExcerpt = sanitize(excerpt);
    const cleanedExcerpt = cleanupText(sanitizedExcerpt);
    const wordCount = cleanedExcerpt.trim().split(/\s+/).length;
    
    if (wordCount < 100) {
      toast({
        title: "Short excerpt warning",
        description: `Only ${wordCount} words found. Shorter excerpts may produce incomplete notes.`,
        variant: "default",
      });
    }

    setIsProcessing(true);

    try {
      // Simulate processing time for realistic feel
      await new Promise(resolve => setTimeout(resolve, 2000));

      const keywords = extractKeywords(cleanedExcerpt);
      
      // In strict mode, generate takeaway suggestions first
      if (strictMode) {
        const suggestions = extractTakeawaySuggestions(cleanedExcerpt, keywords);
        setSuggestedTakeaways(suggestions);
        setSelectedTakeaways([]); // Reset selections
        
        if (suggestions.length < 5) {
          toast({
            title: "Insufficient takeaway suggestions",
            description: `Only ${suggestions.length} suggestions found. You may need to manually add additional takeaways.`,
            variant: "destructive",
          });
        }
      }

      const note: CornellNote = {
        title: "Agile Extension Study Notes",
        date: new Date().toISOString().split('T')[0],
        module: "Agile Extension v2",
        keywords: sanitize(keywords.join(', ')).split(', ').filter(k => k.trim()),
        questions: generateQuestions(cleanedExcerpt, strictMode).map(qa => ({
          ...qa,
          question: sanitize(qa.question),
          answer: sanitize(qa.answer)
        })),
        takeaways: strictMode ? [] : generateTakeaways(cleanedExcerpt).map(t => sanitize(t)),
        summary: sanitize(generateSummary(cleanedExcerpt))
      };

      // Validate evidence in strict mode
      if (strictMode) {
        validateEvidence(note);
      }

      setCornellNote(note);
      
      if (strictMode) {
        toast({
          title: "Cornell note generated!",
          description: "Please select 5-7 takeaways from the suggestions below.",
        });
      } else {
        toast({
          title: "Cornell note generated!",
          description: "Your study notes are ready for review.",
        });
      }
    } catch (error) {
      toast({
        title: "Generation failed",
        description: "There was an error generating your Cornell note. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const extractKeywords = (text: string): string[] => {
    const textLower = text.toLowerCase();
    
    // AAC exam-critical terms only - prioritize most important concepts
    const aacCriticalTerms = [
      'agile mindset',
      'business value',
      'rolling-wave planning', 
      'three horizons',
      'babok v3 integration',
      'strategy horizon',
      'initiative horizon', 
      'delivery horizon',
      'adaptive planning',
      'progressive elaboration',
      'stakeholder collaboration',
      'agile extension',
      'context-appropriate practices',
      'value prioritization',
      'iterative development'
    ];
    
    // Find AAC critical terms that exist in the text
    const foundCriticalTerms = aacCriticalTerms.filter(term => 
      textLower.includes(term.toLowerCase())
    );
    
    // If we need more terms, extract clean conceptual phrases (no filler/numbering)
    if (foundCriticalTerms.length < 5) {
      const words = textLower.split(/\s+/);
      const conceptualPhrases: { [key: string]: number } = {};
      
      // Look for 2-3 word conceptual phrases
      for (let i = 0; i < words.length - 1; i++) {
        const twoWord = words.slice(i, i + 2).join(' ');
        const threeWord = words.slice(i, i + 3).join(' ');
        
        // Only include substantive concepts, avoid filler words and numbering
        if (twoWord.length > 8 && 
            !twoWord.match(/\d/) && 
            !['the ', 'and ', 'that ', 'this ', 'with ', 'from ', 'they ', 'have ', 'will ', 'can ', 'are ', 'for '].some(filler => twoWord.includes(filler))) {
          conceptualPhrases[twoWord] = (conceptualPhrases[twoWord] || 0) + 1;
        }
        if (threeWord.length > 12 && 
            !threeWord.match(/\d/) && 
            !['the ', 'and ', 'that ', 'this ', 'with ', 'from ', 'they ', 'have ', 'will ', 'can ', 'are ', 'for '].some(filler => threeWord.includes(filler))) {
          conceptualPhrases[threeWord] = (conceptualPhrases[threeWord] || 0) + 1;
        }
      }
      
      // Get most relevant conceptual phrases
      const additionalTerms = Object.entries(conceptualPhrases)
        .filter(([term]) => !foundCriticalTerms.some(critical => critical.includes(term)))
        .sort(([,a], [,b]) => b - a)
        .slice(0, 7 - foundCriticalTerms.length)
        .map(([term]) => term);
        
      foundCriticalTerms.push(...additionalTerms);
    }
    
    return foundCriticalTerms.slice(0, 7);
  };

  // Update takeaways with selected suggestions
  const updateTakeawaysFromSelection = () => {
    if (!cornellNote) return;

    const sanitizedTakeaways = selectedTakeaways.map(t => sanitize(t));
    const updatedNote = { ...cornellNote, takeaways: sanitizedTakeaways };
    
    // Re-validate with new takeaways
    if (strictMode) {
      const validation = validateStrictMode(updatedNote);
      updatedNote.isValid = validation.isValid;
      updatedNote.validationErrors = validation.errors;
    }
    
    setCornellNote(updatedNote);
  };

  // Auto-update takeaways when selections change
  useEffect(() => {
    if (strictMode && cornellNote && selectedTakeaways.length > 0) {
      updateTakeawaysFromSelection();
    }
  }, [selectedTakeaways, strictMode]);

  const validateStrictMode = (note: CornellNote): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Check keyword count (5-7)
    if (note.keywords.length < 5 || note.keywords.length > 7) {
      errors.push(`Keywords must be 5-7 items (found ${note.keywords.length})`);
    }
    
    // Check Q&A count (≥5)
    if (note.questions.length < 5) {
      errors.push(`Q&A must have ≥5 items (found ${note.questions.length})`);
    }
    
    // Check takeaways count (5-7) - use selectedTakeaways in strict mode
    const takeawayCount = strictMode && selectedTakeaways.length > 0 ? selectedTakeaways.length : note.takeaways.length;
    if (takeawayCount < 5 || takeawayCount > 7) {
      errors.push(`Takeaways must be 5-7 items (found ${takeawayCount})`);
    }
    
    // Check summary sentence count (4-8)
    const summaryBlocks = note.summary.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (summaryBlocks.length < 4 || summaryBlocks.length > 8) {
      errors.push(`Summary must be 4-8 sentences (found ${summaryBlocks.length})`);
    }
    
    // Check each Q&A item for full sentences (no evidence required)
    note.questions.forEach((qa, index) => {
      // Check answer is full sentence (no ellipses, ends with punctuation)
      if (qa.answer.includes('...')) {
        errors.push(`Q${index + 1} answer contains ellipses - must be full sentences`);
      }
      
      if (!qa.answer.match(/[.!?]$/)) {
        errors.push(`Q${index + 1} answer must end with punctuation`);
      }
    });
    
    // Check keyword uniqueness
    const uniqueKeywords = new Set(note.keywords);
    if (uniqueKeywords.size !== note.keywords.length) {
      errors.push('All keywords must be unique');
    }
    
    // Check question uniqueness
    const uniqueQuestions = new Set(note.questions.map(q => q.question));
    if (uniqueQuestions.size !== note.questions.length) {
      errors.push('All questions must be unique');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const validateEvidence = (note: CornellNote) => {
    if (strictMode) {
      const validation = validateStrictMode(note);
      note.isValid = validation.isValid;
      note.validationErrors = validation.errors;
      
      if (!validation.isValid) {
        toast({
          title: "Strict Mode Validation Failed",
          description: `${validation.errors.length} issues found. Export blocked until resolved.`,
          variant: "destructive",
        });
      }
    }
    // No validation needed for non-strict mode since evidence is no longer required
  };

  const generateQuestions = (text: string, isStrict: boolean = false): Array<{ question: string; answer: string; evidence?: string; needsReview?: boolean }> => {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 30);
    const questions: Array<{ question: string; answer: string; evidence?: string; needsReview?: boolean }> = [];
    const usedContent = new Set<string>();
    
    // Helper to create 2-3 crisp, integrated sentences from content - no duplication
    const createCrispAnswer = (primarySentence: string, contextSentences: string[] = []): string => {
      // Clean the primary sentence
      let primaryCleaned = primarySentence.trim();
      
      // Find one complementary sentence that adds value
      const relatedSentence = contextSentences.find(s => {
        const sWords = s.toLowerCase().split(/\s+/);
        const pWords = primaryCleaned.toLowerCase().split(/\s+/);
        const commonWords = pWords.filter(w => sWords.includes(w) && w.length > 4);
        
        // Avoid repetitive phrases
        const primaryKey = primaryCleaned.toLowerCase().substring(0, 50);
        const candidateKey = s.toLowerCase().substring(0, 50);
        const similarity = calculateSimilarity(primaryKey, candidateKey);
        
        return s.trim().length > 25 && 
               !usedContent.has(s.trim()) && 
               commonWords.length >= 1 &&
               commonWords.length <= 3 &&
               s.trim() !== primaryCleaned &&
               similarity < 0.7; // Avoid repetitive content
      });
      
      // Create 1-2 sentence integrated answer
      if (relatedSentence && primaryCleaned.split(/\s+/).length < 25) {
        usedContent.add(relatedSentence.trim());
        const sentence1 = primaryCleaned.endsWith('.') ? primaryCleaned : primaryCleaned + '.';
        const sentence2 = relatedSentence.trim().endsWith('.') ? relatedSentence.trim() : relatedSentence.trim() + '.';
        return `${sentence1} ${sentence2}`;
      }
      
      return primaryCleaned.endsWith('.') ? primaryCleaned : primaryCleaned + '.';
    };

    // Exactly 5 AAC exam-focused conceptual questions testing understanding
    const questionTemplates = [
      {
        pattern: ['horizon', 'framework', 'model', 'approach', 'structure', 'three', 'strategy', 'initiative', 'delivery'],
        question: "How does the Three Horizons framework organize agile business analysis work?"
      },
      {
        pattern: ['agile', 'mindset', 'adaptive', 'collaborative', 'iterative', 'flexible', 'context'],
        question: "What distinguishes agile as a mindset versus a set of practices?"
      },
      {
        pattern: ['value', 'benefit', 'outcome', 'delivery', 'customer', 'stakeholder', 'business'],
        question: "How does the Agile Extension emphasize business value delivery over process compliance?"
      },
      {
        pattern: ['planning', 'rolling-wave', 'progressive', 'elaboration', 'requirements', 'adaptive'],
        question: "What are the key characteristics of rolling-wave planning in agile contexts?"
      },
      {
        pattern: ['babok', 'extension', 'complement', 'enhance', 'integrate', 'map', 'practices'],
        question: "How does the Agile Extension v2 integrate with and enhance BABOK v3 practices?"
      }
    ];
    
    // Generate exactly 5 questions using the templates
    questionTemplates.forEach((template, index) => {
      const sentence = sentences.find(s => {
        const lower = s.toLowerCase();
        return !usedContent.has(s.trim()) && 
               template.pattern.some(keyword => lower.includes(keyword));
      });
      
      if (sentence) {
        const answer = createCrispAnswer(sentence, sentences);
        questions.push({
          question: template.question,
          answer: answer
        });
        usedContent.add(sentence.trim());
      } else {
        // Fallback to any substantive sentence for this template
        const fallbackSentence = sentences.find(s => 
          !usedContent.has(s.trim()) && s.trim().length > 40
        );
        
        if (fallbackSentence) {
          const answer = createCrispAnswer(fallbackSentence, sentences);
          questions.push({
            question: template.question,
            answer: answer
          });
          usedContent.add(fallbackSentence.trim());
        }
      }
    });
    
    return questions.slice(0, 5);
  };

  const generateTakeaways = (text: string): string[] => {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const takeaways: string[] = [];
    const usedSentences = new Set<string>();
    
    // Core relationship and distinction takeaways for AAC exam - full sentences emphasizing relationships
    const coreTemplates = [
      {
        keywords: ['mindset', 'practices', 'agile', 'context-appropriate'],
        fallback: "Agile is a mindset expressed via context-appropriate practices, not a fixed set of methodologies."
      },
      {
        keywords: ['horizon', 'strategy', 'initiative', 'delivery', 'framework', 'three'],
        fallback: "Three Horizons framework provides Structure-Initiative-Delivery (SID) levels for organizing rolling-wave planning across different time spans."
      },
      {
        keywords: ['business value', 'value delivery', 'customer', 'outcomes', 'stakeholder'],
        fallback: "Business value delivery through stakeholder collaboration takes priority over rigid process adherence."
      },
      {
        keywords: ['beyond software', 'all contexts', 'broader', 'not limited', 'any business'],
        fallback: "Agile Extension v2 scope extends beyond software development to encompass all business analysis contexts."
      },
      {
        keywords: ['babok', 'complement', 'extension', 'enhance', 'integrate', 'maps'],
        fallback: "AE v2 maps mindset-led BA practices to BABOK v3 without providing a fixed checklist approach."
      },
      {
        keywords: ['rolling-wave', 'progressive', 'elaboration', 'adaptive', 'planning'],
        fallback: "Rolling-wave and progressive elaboration techniques enable adaptive planning that responds to changing requirements."
      }
    ];
    
    // Find sentences for each core template - ensure full sentences
    coreTemplates.forEach(template => {
      const matchingSentence = sentences.find(s => {
        const lower = s.toLowerCase();
        const trimmed = s.trim();
        const filterResult = filterQuestionTakeaways(trimmed);
        return filterResult.isValid && 
               !usedSentences.has(trimmed) && 
               trimmed.length > 25 &&
               template.keywords.some(keyword => lower.includes(keyword));
      });
      
      if (matchingSentence) {
        const cleaned = matchingSentence.trim();
        const finalTakeaway = cleaned.endsWith('.') ? cleaned : cleaned + '.';
        takeaways.push(finalTakeaway);
        usedSentences.add(cleaned);
      } else {
        takeaways.push(template.fallback);
      }
    });
    
    // Filter to prevent duplication and ensure 5-7 unique takeaways
    const uniqueTakeaways = takeaways.filter((takeaway, index) => {
      return !takeaways.slice(0, index).some(existing => 
        calculateSimilarity(takeaway, existing) > 0.6
      );
    });
    
    return uniqueTakeaways.slice(0, 7);
  };

  const generateSummary = (text: string): string => {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    // Build integrated summary following the order: purpose → horizons/rolling-wave → mindset vs practices → scope → business value
    let summaryParts: string[] = [];
    
    // 1. Purpose - What is the Agile Extension v2 and why does it exist?
    const purposeSentence = sentences.find(s => {
      const lower = s.toLowerCase();
      return (lower.includes('agile extension') && lower.includes('v2')) || 
             lower.includes('purpose') || 
             (lower.includes('provides') && lower.includes('guidance')) ||
             (lower.includes('maps') && lower.includes('babok'));
    });
    
    if (purposeSentence) {
      summaryParts.push(purposeSentence.trim());
    } else {
      summaryParts.push("The Agile Extension v2 maps mindset-led business analysis practices to BABOK v3, providing comprehensive guidance for agile and adaptive contexts");
    }
    
    // 2. Horizons/Rolling-wave - How is the framework structured?
    const horizonSentence = sentences.find(s => {
      const lower = s.toLowerCase();
      return (lower.includes('horizon') && (lower.includes('three') || lower.includes('framework'))) || 
             lower.includes('rolling-wave') || 
             lower.includes('progressive elaboration') ||
             (lower.includes('strategy') && lower.includes('initiative') && lower.includes('delivery'));
    });
    
    if (horizonSentence) {
      summaryParts.push("It utilizes " + horizonSentence.trim().charAt(0).toLowerCase() + horizonSentence.trim().slice(1));
    } else {
      summaryParts.push("It utilizes the Three Horizons framework (Strategy, Initiative, Delivery) with rolling-wave planning and progressive elaboration techniques");
    }
    
    // 3. Mindset vs Practices - What philosophical approach does it emphasize?
    const mindsetSentence = sentences.find(s => {
      const lower = s.toLowerCase();
      return (lower.includes('mindset') && (lower.includes('practices') || lower.includes('context'))) || 
             (lower.includes('collaborative') && lower.includes('adaptive')) ||
             lower.includes('context-appropriate');
    });
    
    if (mindsetSentence) {
      summaryParts.push("This emphasizes " + mindsetSentence.trim().charAt(0).toLowerCase() + mindsetSentence.trim().slice(1));
    } else {
      summaryParts.push("This emphasizes agile as a mindset expressed through context-appropriate practices rather than rigid methodologies");
    }
    
    // 4. Scope - What contexts does it apply to?
    const scopeSentence = sentences.find(s => {
      const lower = s.toLowerCase();
      return (lower.includes('beyond software') || lower.includes('all contexts') || lower.includes('broader')) ||
             (lower.includes('business analysis') && lower.includes('contexts'));
    });
    
    if (scopeSentence) {
      summaryParts.push("The scope extends " + scopeSentence.trim().charAt(0).toLowerCase() + scopeSentence.trim().slice(1));
    } else {
      summaryParts.push("The scope extends beyond software development to all business analysis contexts while integrating with core BABOK practices");
    }
    
    // 5. Business Value - What is the ultimate goal?
    const valueSentence = sentences.find(s => {
      const lower = s.toLowerCase();
      return (lower.includes('business value') || 
             (lower.includes('value') && lower.includes('delivery'))) ||
             (lower.includes('stakeholder') && lower.includes('collaboration'));
    });
    
    if (valueSentence) {
      summaryParts.push("Ultimately, it focuses on " + valueSentence.trim().charAt(0).toLowerCase() + valueSentence.trim().slice(1));
    } else {
      summaryParts.push("Ultimately, it focuses on delivering maximum business value through stakeholder collaboration and adaptive planning that responds to changing requirements");
    }
    
    // Clean up and create flowing paragraph (4-6 sentences) - check for duplicates
    const cleanedParts = summaryParts
      .filter(Boolean)
      .map(part => {
        const trimmed = part.trim();
        return trimmed.endsWith('.') || trimmed.endsWith('!') ? trimmed : trimmed + '.';
      })
      .filter((part, index, array) => {
        // Remove parts that are too similar to previous ones
        return !array.slice(0, index).some(existing => 
          calculateSimilarity(part, existing) > 0.7
        );
      })
      .slice(0, 6);
    
    return cleanedParts.join(' ');
  };

  const copyToClipboard = () => {
    if (!cornellNote) return;
    
    // In strict mode, block export if validation fails
    if (strictMode && cornellNote.isValid === false) {
      toast({
        title: "Export blocked",
        description: "Fix validation errors before exporting in Strict Mode.",
        variant: "destructive",
      });
      return;
    }

    // Sanitize all content before copying to ensure clipboard matches UI
    const sanitizedKeywords = cornellNote.keywords.map(k => sanitize(k));
    const sanitizedQuestions = cornellNote.questions.map(qa => ({
      ...qa,
      question: sanitize(qa.question),
      answer: sanitize(qa.answer)
    }));
    const sanitizedTakeaways = cornellNote.takeaways.map(t => sanitize(t));
    const sanitizedSummary = sanitize(cornellNote.summary);

    const markdownContent = strictMode ? 
      // Strict mode format with evidence
      `# ${cornellNote.title}
**Date:** ${cornellNote.date}  
**Module:** ${cornellNote.module}  

<!-- keywords:start -->
## Keywords
${sanitizedKeywords.map(keyword => `- ${keyword}`).join('\n')}
<!-- keywords:end -->

<!-- qa:start -->
## Questions & Answers
${sanitizedQuestions.map((qa, index) => 
  `- **Q${index + 1}:** ${qa.question}
  <details><summary>Answer</summary>
  <p>${qa.answer}</p>
  <p><em>Evidence:</em> "${qa.evidence || 'Not provided'}"</p>
  </details>`
).join('\n\n')}
<!-- qa:end -->

<!-- takeaways:start -->
## Takeaways
${sanitizedTakeaways.map(takeaway => `- ${takeaway}`).join('\n')}
<!-- takeaways:end -->

<!-- summary:start -->
## Summary
${sanitizedSummary}
<!-- summary:end -->` :
      // Standard format  
      `# ${cornellNote.title}
**Date:** ${cornellNote.date}  
**Module:** ${cornellNote.module}  

<!-- keywords:start -->
## Keywords
${sanitizedKeywords.map(keyword => `- ${keyword}`).join('\n')}
<!-- keywords:end -->

<!-- qa:start -->
## Questions & Answers
${sanitizedQuestions.map((qa, index) => 
  `- **Q${index + 1}:** ${qa.question}\n  <details><summary>Answer</summary><p>${qa.answer}</p></details>`
).join('\n\n')}
<!-- qa:end -->

<!-- takeaways:start -->
## Takeaways
${sanitizedTakeaways.map(takeaway => `- ${takeaway}`).join('\n')}
<!-- takeaways:end -->

<!-- summary:start -->
## Summary
${sanitizedSummary}
<!-- summary:end -->`;

    navigator.clipboard.writeText(markdownContent);
    toast({
      title: "Copied to clipboard!",
      description: "Your Cornell note has been copied in markdown format.",
    });
  };

  return (
    <div className="min-h-screen gradient-subtle">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center shadow-elegant">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              AAC Study Helper
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transform Agile Extension v2 excerpts into Cornell-style study notes for your AAC exam preparation
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Paste Your Excerpt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste a single excerpt (already split by chapter/topic). The app creates one note per excerpt."
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                className="min-h-[350px] resize-none border-border/50 focus:border-primary transition-smooth"
              />
              
              {/* Strict Mode Toggle */}
              <div className="flex items-center justify-between p-3 bg-accent/10 rounded-lg border border-accent/20">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-accent" />
                  <div>
                <Label htmlFor="strict-mode" className="font-medium">Strict Mode</Label>
                    <p className="text-sm text-muted-foreground">Enhanced validation for exam preparation</p>
                  </div>
                </div>
                <Switch
                  id="strict-mode"
                  checked={strictMode}
                  onCheckedChange={setStrictMode}
                />
              </div>

              {/* Domain Vocabulary Input (Optional) */}
              {strictMode && (
                <div className="space-y-2">
                  <Label htmlFor="domain-vocab" className="text-sm font-medium">
                    Domain Vocabulary (Optional)
                  </Label>
                  <Textarea
                    id="domain-vocab"
                    placeholder="Enter domain-specific terms separated by commas (e.g., sprint, backlog, scrum master)..."
                    value={domainVocabulary}
                    onChange={(e) => setDomainVocabulary(e.target.value)}
                    className="min-h-[80px] resize-none border-border/50 focus:border-primary transition-smooth"
                  />
                  <p className="text-xs text-muted-foreground">
                    These terms will be used to enhance takeaway suggestions scoring.
                  </p>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-muted-foreground">
                  {excerpt.trim().split(/\s+/).filter(word => word.length > 0).length} words
                </Badge>
                <Button 
                  onClick={generateCornellNote}
                  disabled={isProcessing || !excerpt.trim()}
                  className="gradient-primary hover:shadow-elegant transition-smooth"
                >
                  {isProcessing ? "Generating..." : "Generate Cornell Note"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Output Section */}
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Cornell Study Notes
                </span>
                {cornellNote && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                    disabled={strictMode && cornellNote.isValid === false}
                    className={`hover:bg-primary hover:text-primary-foreground transition-smooth ${
                      strictMode && cornellNote.isValid === false 
                        ? 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-current' 
                        : ''
                    }`}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {strictMode && cornellNote.isValid === false ? 'Export Blocked' : 'Copy'}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cornellNote ? (
                <div className="space-y-6 text-sm">
                  {/* Validation Errors for Strict Mode */}
                  {strictMode && cornellNote.validationErrors && cornellNote.validationErrors.length > 0 && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                      <h4 className="font-semibold text-destructive mb-2 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        Strict Mode Validation Errors
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-destructive text-sm">
                        {cornellNote.validationErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                      <p className="text-xs text-destructive/80 mt-2">
                        Export is blocked until all issues are resolved.
                      </p>
                    </div>
                  )}

                  {/* Header */}
                  <div className="border-b border-border pb-4">
                    <h3 className="text-xl font-bold">{cornellNote.title}</h3>
                    <p className="text-muted-foreground">
                      <strong>Date:</strong> {cornellNote.date} | <strong>Module:</strong> {cornellNote.module}
                    </p>
                  </div>

                  {/* Keywords */}
                  <div>
                    <h4 className="font-semibold text-primary mb-2">Keywords</h4>
                    <div className="flex flex-wrap gap-2">
                      {cornellNote.keywords.map((keyword, index) => (
                        <Badge key={index} variant="secondary">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Questions & Answers */}
                  <div>
                    <h4 className="font-semibold text-primary mb-3">Questions & Answers</h4>
                    <div className="space-y-3">
                      {cornellNote.questions.map((qa, index) => (
                        <div key={index} className={`pl-4 border-l-2 ${qa.needsReview ? 'border-destructive/50 bg-destructive/5' : 'border-accent/30'}`}>
                          <p className="font-medium">Q{index + 1}: {qa.question}</p>
                          <p className="text-muted-foreground mt-1 italic">Answer: {qa.answer}</p>
                          {qa.evidence && (
                            <p className="text-xs text-primary mt-1 font-mono bg-primary/10 px-2 py-1 rounded">
                              Evidence: "{qa.evidence}"
                            </p>
                          )}
                          {qa.needsReview && (
                            <p className="text-xs text-destructive mt-1 font-medium">
                              ⚠️ Needs review - missing evidence
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Takeaways */}
                  <div>
                    <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
                      Takeaways
                      {strictMode && (
                        <Badge variant="outline" className="text-xs">
                          {selectedTakeaways.length}/5-7 selected
                        </Badge>
                      )}
                    </h4>
                    {cornellNote.takeaways.length > 0 ? (
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        {cornellNote.takeaways.map((takeaway, index) => (
                          <li key={index}>{takeaway}</li>
                        ))}
                      </ul>
                    ) : strictMode ? (
                      <p className="text-muted-foreground text-sm italic">
                        Select 5-7 takeaways from the suggestions below to populate this section.
                      </p>
                    ) : null}
                  </div>

                  {/* Summary */}
                  <div>
                    <h4 className="font-semibold text-primary mb-2">Summary</h4>
                    <p className="text-muted-foreground leading-relaxed">{cornellNote.summary}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Your Cornell note will appear here after processing</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Takeaway Suggestions Tray (Strict Mode Only) */}
        {strictMode && suggestedTakeaways.length > 0 && (
          <Card className="shadow-soft border-0 mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-accent" />
                Suggested Takeaways
                <Badge variant="outline" className="ml-2">
                  {selectedTakeaways.length}/5-7 selected
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Select 5-7 takeaways from the suggestions below. These were scored using domain-neutral heuristics based on your excerpt.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 max-h-96 overflow-y-auto">
                {suggestedTakeaways.map((suggestion, index) => (
                  <div 
                    key={index} 
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-smooth cursor-pointer hover:shadow-soft ${
                      suggestion.selected 
                        ? 'bg-primary/10 border-primary/30' 
                        : 'bg-card border-border hover:border-primary/20'
                    }`}
                    onClick={() => handleTakeawaySelection(suggestion.sentence, !suggestion.selected)}
                  >
                    <Checkbox
                      checked={suggestion.selected}
                      onCheckedChange={(checked) => handleTakeawaySelection(suggestion.sentence, checked as boolean)}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm leading-relaxed">{suggestion.sentence}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Score: {suggestion.score}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {suggestion.sentence.split(/\s+/).length} words
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {selectedTakeaways.length < 5 && (
                <div className="mt-4 p-3 bg-accent/10 border border-accent/20 rounded-lg">
                  <p className="text-sm text-accent font-medium mb-1">
                    ⚠️ Need more takeaways
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Select at least {5 - selectedTakeaways.length} more takeaway{5 - selectedTakeaways.length !== 1 ? 's' : ''} to meet the minimum requirement for export.
                  </p>
                </div>
              )}
              
              {selectedTakeaways.length > 7 && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive font-medium mb-1">
                    ⚠️ Too many takeaways
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Deselect {selectedTakeaways.length - 7} takeaway{selectedTakeaways.length - 7 !== 1 ? 's' : ''} to meet the maximum requirement.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}