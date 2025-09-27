import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, BookOpen, CheckCircle2, Copy, Lightbulb, MessageSquare, Target, FileText, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { sanitize } from '@/lib/sanitize';
import { generateCornellNoteWithAI } from '@/lib/openai';
import { ExampleExcerpts } from './ExampleExcerpts';
import { HelpTooltip } from './HelpTooltip';
import { useToast } from '@/hooks/use-toast';

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
  questionsAndAnswers: Array<{ question: string; answer: string }>;
  takeaways: string[];
  summary: string;
  strictModeValidation?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } | null;
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

export const CornellNoteGenerator = () => {
  const [excerpt, setExcerpt] = useState('');
  const [cornellNote, setCornellNote] = useState<CornellNote | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [strictMode, setStrictMode] = useState(false);
  const [suggestedTakeaways, setSuggestedTakeaways] = useState<TakeawaySuggestion[]>([]);
  const [selectedTakeaways, setSelectedTakeaways] = useState<Set<string>>(new Set());
  const [domainVocabulary, setDomainVocabulary] = useState('');
  const [showExamples, setShowExamples] = useState(false);
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
    
    // For question patterns, just filter them out
    return { isValid: false };
  };

  // Extract takeaway suggestions using domain-neutral scoring heuristic
  const extractTakeawaySuggestions = (text: string, keywords: string[] = []): TakeawaySuggestion[] => {
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
        new Set([...prev, sentence])
      );
    } else {
      setSelectedTakeaways(prev => {
        const newSet = new Set(prev);
        newSet.delete(sentence);
        return newSet;
      });
    }
  };

  const generateCornellNote = useCallback(async () => {
    if (!excerpt.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter an excerpt to process."
      });
      return;
    }

    const wordCount = excerpt.trim().split(/\s+/).length;
    if (wordCount < 50) {
      toast({
        variant: "destructive", 
        title: "Warning",
        description: "The excerpt seems short. For best results, provide at least 50 words."
      });
      // Continue processing instead of returning - soft warning only
    }

    setIsProcessing(true);
    setSuggestedTakeaways([]);
    setSelectedTakeaways(new Set());

    try {
      // Use AI to generate the Cornell note
      const sanitizedExcerpt = sanitize(excerpt);
      const aiResponse = await generateCornellNoteWithAI(SYSTEM_PROMPT, sanitizedExcerpt);
      
      // Parse the AI response (assuming it returns clean markdown)
      // For now, we'll create a structured note from the AI response
      const note: CornellNote = {
        title: `Study Notes - ${new Date().toLocaleDateString()}`,
        date: new Date().toLocaleDateString(),
        module: 'Agile Extension v2',
        keywords: [], // Will be extracted from AI response
        questionsAndAnswers: [], // Will be extracted from AI response
        takeaways: [], // Will be extracted from AI response
        summary: '', // Will be extracted from AI response
        strictModeValidation: null
      };

      // For now, parse the AI response and structure it properly
      // This is a simplified version - in production you'd want more robust parsing
      const cleanedResponse = sanitize(aiResponse);
      
      // Extract sections from the AI response
      const keywordsMatch = cleanedResponse.match(/## Keywords\s*\n((?:- .+\n?)*)/);
      const questionsMatch = cleanedResponse.match(/## Questions & Answers\s*\n((?:- \*\*Q\d+:\*\* .+\n(?:\s{2,}Answer: .+\n?)*)*)/);
      const takeawaysMatch = cleanedResponse.match(/## Takeaways\s*\n((?:- .+\n?)*)/);
      const summaryMatch = cleanedResponse.match(/## Summary\s*\n(.+?)(?=\n##|$)/s);

      if (keywordsMatch) {
        note.keywords = keywordsMatch[1].split('\n')
          .filter(line => line.trim().startsWith('-'))
          .map(line => sanitize(line.replace(/^-\s*/, '').trim()))
          .filter(keyword => keyword.length > 0);
      }

      if (questionsMatch) {
        const qaPairs = questionsMatch[1].split(/(?=- \*\*Q\d+:\*\*)/);
        note.questionsAndAnswers = qaPairs
          .filter(pair => pair.trim())
          .map(pair => {
            const questionMatch = pair.match(/- \*\*Q\d+:\*\* (.+)/);
            const answerMatch = pair.match(/Answer: (.+)/s);
            if (questionMatch && answerMatch) {
              return {
                question: sanitize(questionMatch[1].trim()),
                answer: sanitize(answerMatch[1].trim())
              };
            }
            return null;
          })
          .filter(qa => qa !== null) as Array<{question: string, answer: string}>;
      }

      if (takeawaysMatch) {
        note.takeaways = takeawaysMatch[1].split('\n')
          .filter(line => line.trim().startsWith('-'))
          .map(line => sanitize(line.replace(/^-\s*/, '').trim()))
          .filter(takeaway => takeaway.length > 0);
      }

      if (summaryMatch) {
        note.summary = sanitize(summaryMatch[1].trim());
      }

      // Validate strict mode if enabled
      if (strictMode) {
        note.strictModeValidation = validateStrictMode(note);
        const suggestions = extractTakeawaySuggestions(sanitizedExcerpt, note.keywords);
        setSuggestedTakeaways(suggestions);
      }

      setCornellNote(note);
      
      toast({
        title: "Success!",
        description: "Cornell notes generated successfully."
      });

    } catch (error) {
      console.error('Error generating Cornell note:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate Cornell note. Please try again."
      });
    } finally {
      setIsProcessing(false);
    }
  }, [excerpt, strictMode, domainVocabulary, toast]);

  const validateStrictMode = (note: CornellNote) => {
    const errors: string[] = [];
    
    // Check keyword count (5-7)
    if (note.keywords.length < 5) {
      errors.push(`Only ${note.keywords.length} keywords found. Need at least 5.`);
    } else if (note.keywords.length > 7) {
      errors.push(`Too many keywords (${note.keywords.length}). Maximum is 7.`);
    }
    
    // Check question count (exactly 5)
    if (note.questionsAndAnswers.length !== 5) {
      errors.push(`${note.questionsAndAnswers.length} questions found. Need exactly 5.`);
    }
    
    // Check takeaway count (5-7) - use selected takeaways in strict mode
    const takeawayCount = selectedTakeaways.size;
    if (takeawayCount < 5) {
      errors.push(`Only ${takeawayCount} takeaways selected. Need at least 5.`);
    } else if (takeawayCount > 7) {
      errors.push(`Too many takeaways selected (${takeawayCount}). Maximum is 7.`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  };

  const updateTakeawaysFromSelection = () => {
    if (cornellNote && strictMode) {
      const selectedTakeawaysList = Array.from(selectedTakeaways);
      const updatedNote = {
        ...cornellNote,
        takeaways: selectedTakeawaysList
      };
      
      updatedNote.strictModeValidation = validateStrictMode(updatedNote);
      setCornellNote(updatedNote);
    }
  };

  useEffect(() => {
    updateTakeawaysFromSelection();
  }, [selectedTakeaways, cornellNote?.questionsAndAnswers]);

  const copyToClipboard = useCallback(async () => {
    if (!cornellNote) return;

    // Apply sanitization before copying to ensure clean output
    const sanitizedNote = {
      ...cornellNote,
      keywords: cornellNote.keywords.map(keyword => sanitize(keyword)),
      questionsAndAnswers: cornellNote.questionsAndAnswers.map(qa => ({
        ...qa,
        question: sanitize(qa.question),
        answer: sanitize(qa.answer)
      })),
      takeaways: cornellNote.takeaways.map(takeaway => sanitize(takeaway)),
      summary: sanitize(cornellNote.summary)
    };

    const markdown = formatAsMarkdown(sanitizedNote);
    
    try {
      await navigator.clipboard.writeText(markdown);
      toast({
        title: "Copied!",
        description: "Cornell note copied to clipboard."
      });
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy to clipboard. Please try again."
      });
    }
  }, [cornellNote, toast]);

  const handleExcerptSelect = useCallback((content: string) => {
    setExcerpt(content);
    setShowExamples(false);
  }, []);

  const formatAsMarkdown = (note: CornellNote): string => {
    return `# ${note.title}
**Date:** ${note.date}  
**Module:** ${note.module}  

## Keywords
${note.keywords.map(keyword => `- ${keyword}`).join('\n')}

## Questions & Answers
${note.questionsAndAnswers.map((qa, index) => 
  `- **Q${index + 1}:** ${qa.question}
  Answer: ${qa.answer}`
).join('\n\n')}

## Takeaways
${note.takeaways.map(takeaway => `- ${takeaway}`).join('\n')}

## Summary
${note.summary}`;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-2">
          <BookOpen className="w-8 h-8 text-primary" />
          Cornell Note Generator
          <Sparkles className="w-6 h-6 text-accent" />
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Transform AAC Agile Extension v2 excerpts into structured study notes with AI-powered analysis.
        </p>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card className="lg:sticky lg:top-6 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Input Excerpt
              <HelpTooltip content="Paste a single AAC excerpt that's already been split by chapter or topic. Each excerpt will generate one complete set of Cornell notes." />
            </CardTitle>
            <CardDescription>
              Paste a single excerpt (already split by chapter/topic). The app creates one note per excerpt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Paste your AAC excerpt here..."
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className="min-h-[300px] text-sm leading-relaxed transition-smooth focus:shadow-soft"
            />
            
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Word count: {excerpt.trim().split(/\s+/).filter(word => word.length > 0).length}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExamples(!showExamples)}
                className="text-xs text-accent hover:text-accent-foreground"
              >
                {showExamples ? 'Hide' : 'Show'} Examples
              </Button>
            </div>
            
            {showExamples && (
              <ExampleExcerpts onExcerptSelect={handleExcerptSelect} />
            )}

            <Separator />

            {/* Controls */}
            <div className="grid gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="strict-mode"
                  checked={strictMode}
                  onCheckedChange={setStrictMode}
                />
                <Label htmlFor="strict-mode" className="text-sm font-medium">
                  Strict Mode (Enhanced Validation)
                </Label>
                <HelpTooltip content="Enables additional validation, content suggestions, and quality checks to ensure your notes meet exam preparation standards." />
              </div>

              {strictMode && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Label htmlFor="domain-vocab" className="text-sm font-medium">
                      Domain Vocabulary (Optional)
                    </Label>
                    <HelpTooltip content="Add specific terms or concepts you want to emphasize in the notes. This helps the AI focus on the most relevant vocabulary for your study needs." />
                  </div>
                  <Textarea
                    id="domain-vocab"
                    placeholder="Enter domain-specific terms or concepts to emphasize (one per line)..."
                    value={domainVocabulary}
                    onChange={(e) => setDomainVocabulary(e.target.value)}
                    className="h-20 text-sm transition-smooth focus:shadow-soft"
                  />
                </div>
              )}

            <Button 
              onClick={generateCornellNote} 
              disabled={isProcessing || !excerpt.trim()}
              className="w-full gradient-primary text-primary-foreground hover:shadow-elegant transition-smooth"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Notes...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Cornell Notes
                </>
              )}
            </Button>
            </div>
          </CardContent>
        </Card>

        {/* Output Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Generated Notes
              </span>
              {cornellNote && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                  className="transition-smooth hover:bg-accent hover:text-accent-foreground"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cornellNote ? (
              <div className="space-y-6">
                {/* Strict Mode Validation */}
                {strictMode && cornellNote.strictModeValidation && !cornellNote.strictModeValidation.isValid && (
                  <Alert variant="destructive">
                    <ShieldCheck className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium mb-2">Validation Issues:</div>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {cornellNote.strictModeValidation.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Header */}
                <div className="border-b border-border pb-4">
                  <h3 className="text-xl font-bold text-foreground">{cornellNote.title}</h3>
                  <p className="text-muted-foreground">
                    <strong>Date:</strong> {cornellNote.date} | <strong>Module:</strong> {cornellNote.module}
                  </p>
                </div>

                {/* Keywords */}
                <div>
                  <h4 className="font-semibold text-primary mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" />
                    Keywords ({cornellNote.keywords.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {cornellNote.keywords.map((keyword, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Questions & Answers */}
                <div>
                  <h4 className="font-semibold text-primary mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Questions & Answers ({cornellNote.questionsAndAnswers.length})
                  </h4>
                  <div className="space-y-4">
                    {cornellNote.questionsAndAnswers.map((qa, index) => (
                      <div key={index} className="border-l-2 border-accent/30 pl-4">
                        <p className="font-medium text-foreground">Q{index + 1}: {qa.question}</p>
                        <p className="text-muted-foreground mt-2">{qa.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Takeaways */}
                <div>
                  <h4 className="font-semibold text-primary mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Takeaways ({cornellNote.takeaways.length})
                  </h4>
                  <ul className="space-y-2">
                    {cornellNote.takeaways.map((takeaway, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-accent font-bold mt-1">•</span>
                        <span className="text-muted-foreground">{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Summary */}
                <div>
                  <h4 className="font-semibold text-primary mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Summary
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">{cornellNote.summary}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Generate your first Cornell note by pasting an AAC excerpt above.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Takeaway Suggestions Tray (Strict Mode) */}
      {strictMode && suggestedTakeaways.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-accent" />
                Suggested Takeaways
              </span>
              <Badge variant="outline">
                {selectedTakeaways.size} of {suggestedTakeaways.length} selected
              </Badge>
            </CardTitle>
            <CardDescription>
              Select 5-7 key takeaways from the suggestions below. These will be used in your Cornell note.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {suggestedTakeaways.map((suggestion, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-smooth">
                  <Checkbox
                    id={`suggestion-${index}`}
                    checked={suggestion.selected}
                    onCheckedChange={(checked) => handleTakeawaySelection(suggestion.sentence, checked as boolean)}
                  />
                  <div className="flex-1">
                    <label 
                      htmlFor={`suggestion-${index}`}
                      className="text-sm cursor-pointer text-foreground"
                    >
                      {suggestion.sentence}
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        Score: {suggestion.score}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {selectedTakeaways.size < 5 && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please select at least 5 takeaways to meet Cornell note standards.
                  Currently selected: {selectedTakeaways.size}
                </AlertDescription>
              </Alert>
            )}

            {selectedTakeaways.size > 7 && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Too many takeaways selected ({selectedTakeaways.size}). Please select no more than 7 for optimal study effectiveness.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};