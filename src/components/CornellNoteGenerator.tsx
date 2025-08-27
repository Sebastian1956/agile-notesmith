import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Copy, FileText, Sparkles, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export function CornellNoteGenerator() {
  const [excerpt, setExcerpt] = useState("");
  const [cornellNote, setCornellNote] = useState<CornellNote | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [strictMode, setStrictMode] = useState(false);
  const { toast } = useToast();

  const generateCornellNote = async () => {
    if (!excerpt.trim()) {
      toast({
        title: "No excerpt provided",
        description: "Please paste an excerpt from the Agile Extension v2 to generate notes.",
        variant: "destructive",
      });
      return;
    }

    const wordCount = excerpt.trim().split(/\s+/).length;
    
    if (wordCount < 300) {
      toast({
        title: "Excerpt too short",
        description: "Excerpt too short for Cornell note.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Simulate processing time for realistic feel
      await new Promise(resolve => setTimeout(resolve, 2000));

      const note: CornellNote = {
        title: "Agile Extension Study Notes",
        date: new Date().toISOString().split('T')[0],
        module: "Agile Extension v2",
        keywords: extractKeywords(excerpt),
        questions: generateQuestions(excerpt, strictMode),
        takeaways: generateTakeaways(excerpt),
        summary: generateSummary(excerpt)
      };

      // Validate evidence in strict mode
      if (strictMode) {
        validateEvidence(note);
      }

      setCornellNote(note);
      toast({
        title: "Cornell note generated!",
        description: "Your study notes are ready for review.",
      });
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
    // Extract key terms and phrases directly from the excerpt
    const words = text.toLowerCase().split(/\s+/);
    const phrases = text.toLowerCase().match(/[a-zA-Z\s]{2,}/g) || [];
    
    // Look for important terms mentioned in the text
    const importantTerms: string[] = [];
    const termCounts: { [key: string]: number } = {};
    
    // Extract significant phrases (2-4 words)
    for (let i = 0; i < words.length - 1; i++) {
      const twoWord = words.slice(i, i + 2).join(' ');
      const threeWord = words.slice(i, i + 3).join(' ');
      
      if (twoWord.length > 6 && !twoWord.includes('the') && !twoWord.includes('and')) {
        termCounts[twoWord] = (termCounts[twoWord] || 0) + 1;
      }
      if (threeWord.length > 10 && !threeWord.includes('the') && !threeWord.includes('and')) {
        termCounts[threeWord] = (termCounts[threeWord] || 0) + 1;
      }
    }
    
    // Sort by frequency and take appropriate number of terms
    const sortedTerms = Object.entries(termCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, strictMode ? 7 : 6)
      .map(([term]) => term);
    
    // In strict mode, ensure we have 5-7 unique keywords
    if (strictMode) {
      const targetCount = Math.max(5, Math.min(7, sortedTerms.length));
      if (sortedTerms.length < 5) {
        // Add single important words if we don't have enough phrases
        const singleWords = words.filter(w => w.length > 6 && !['the', 'and', 'that', 'this', 'with'].includes(w));
        const uniqueWords = [...new Set(singleWords)].slice(0, 5 - sortedTerms.length);
        return [...sortedTerms, ...uniqueWords].slice(0, targetCount);
      }
      return sortedTerms.slice(0, targetCount);
    }
    
    return sortedTerms.length >= 5 ? sortedTerms : 
      [...sortedTerms, ...words.filter(w => w.length > 6).slice(0, 6 - sortedTerms.length)];
  };

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
    
    // Check takeaways count (5-7)
    if (note.takeaways.length < 5 || note.takeaways.length > 7) {
      errors.push(`Takeaways must be 5-7 items (found ${note.takeaways.length})`);
    }
    
    // Check summary sentence count (4-8)
    const summaryBlocks = note.summary.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (summaryBlocks.length < 4 || summaryBlocks.length > 8) {
      errors.push(`Summary must be 4-8 sentences (found ${summaryBlocks.length})`);
    }
    
    // Check each Q&A item for evidence and full sentences
    note.questions.forEach((qa, index) => {
      if (!qa.evidence || qa.evidence.trim().length === 0) {
        errors.push(`Q${index + 1} missing evidence quote`);
      }
      
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
        note.questions.forEach(item => {
          if (!item.evidence || item.evidence.trim().length === 0) {
            item.needsReview = true;
          }
        });
        
        toast({
          title: "Strict Mode Validation Failed",
          description: `${validation.errors.length} issues found. Export blocked until resolved.`,
          variant: "destructive",
        });
      }
    } else {
      // Legacy validation for non-strict mode
      let hasIssues = false;
      note.questions.forEach(item => {
        if (!item.evidence || item.evidence.trim().length === 0) {
          item.needsReview = true;
          hasIssues = true;
        }
      });
      
      if (hasIssues) {
        toast({
          title: "Missing evidence detected",
          description: "Some Q&A items lack evidence quotes and need review.",
          variant: "destructive",
        });
      }
    }
  };

  const generateQuestions = (text: string, isStrict: boolean = false): Array<{ question: string; answer: string; evidence?: string; needsReview?: boolean }> => {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const questions: Array<{ question: string; answer: string; evidence?: string; needsReview?: boolean }> = [];
    const usedAnswers = new Set<string>();
    
    // Helper function to get full sentence answer (no ellipses in strict mode)
    const getUniqueAnswer = (sentence: string): string => {
      const trimmed = sentence.trim();
      if (isStrict) {
        // In strict mode, ensure complete sentences without truncation
        return trimmed.endsWith('.') || trimmed.endsWith('!') || trimmed.endsWith('?') ? 
               trimmed : trimmed + '.';
      }
      return trimmed.length > 150 ? trimmed.substring(0, 150) + '...' : trimmed;
    };

    // Helper function to extract evidence (direct quote from text)
    const getEvidence = (sentence: string): string => {
      const words = sentence.trim().split(' ');
      return words.slice(0, 12).join(' ') + (words.length > 12 ? '...' : '');
    };
    
    // Q1: Main topic/subject (use first substantial sentence)
    if (sentences.length > 0) {
      const answer = getUniqueAnswer(sentences[0]);
      const question: { question: string; answer: string; evidence?: string; needsReview?: boolean } = {
        question: "What is the primary subject discussed in this excerpt?",
        answer: answer
      };
      
      if (isStrict) {
        question.evidence = getEvidence(sentences[0]);
        if (!question.evidence.trim()) {
          question.needsReview = true;
        }
      }
      
      questions.push(question);
      usedAnswers.add(answer);
    }
    
    // Q2: Key method/approach (find different sentence with method keywords)
    const methodSentence = sentences.find(s => {
      const answer = getUniqueAnswer(s);
      return !usedAnswers.has(answer) && (
        s.toLowerCase().includes('method') || s.toLowerCase().includes('approach') || 
        s.toLowerCase().includes('technique') || s.toLowerCase().includes('process')
      );
    });
    if (methodSentence && questions.length < 5) {
      const answer = getUniqueAnswer(methodSentence);
      const question: { question: string; answer: string; evidence?: string; needsReview?: boolean } = {
        question: "What method or approach is described?",
        answer: answer
      };
      
      if (isStrict) {
        question.evidence = getEvidence(methodSentence);
        if (!question.evidence.trim()) {
          question.needsReview = true;
        }
      }
      
      questions.push(question);
      usedAnswers.add(answer);
    }
    
    // Q3: Purpose/objective (find different sentence with purpose keywords)
    const purposeSentence = sentences.find(s => {
      const answer = getUniqueAnswer(s);
      return !usedAnswers.has(answer) && (
        s.toLowerCase().includes('purpose') || s.toLowerCase().includes('objective') || 
        s.toLowerCase().includes('goal') || s.toLowerCase().includes('aim')
      );
    });
    if (purposeSentence && questions.length < 5) {
      const answer = getUniqueAnswer(purposeSentence);
      const question: { question: string; answer: string; evidence?: string; needsReview?: boolean } = {
        question: "What purpose or objective is mentioned?",
        answer: answer
      };
      
      if (isStrict) {
        question.evidence = getEvidence(purposeSentence);
        if (!question.evidence.trim()) {
          question.needsReview = true;
        }
      }
      
      questions.push(question);
      usedAnswers.add(answer);
    }
    
    // Q4: Benefits/value (find different sentence with benefit keywords)
    const benefitSentence = sentences.find(s => {
      const answer = getUniqueAnswer(s);
      return !usedAnswers.has(answer) && (
        s.toLowerCase().includes('benefit') || s.toLowerCase().includes('value') || 
        s.toLowerCase().includes('advantage') || s.toLowerCase().includes('outcome')
      );
    });
    if (benefitSentence && questions.length < 5) {
      const answer = getUniqueAnswer(benefitSentence);
      const question: { question: string; answer: string; evidence?: string; needsReview?: boolean } = {
        question: "What benefits or value are highlighted?",
        answer: answer
      };
      
      if (isStrict) {
        question.evidence = getEvidence(benefitSentence);
        if (!question.evidence.trim()) {
          question.needsReview = true;
        }
      }
      
      questions.push(question);
      usedAnswers.add(answer);
    }
    
    // Q5: Requirements/recommendations (find different sentence with requirement keywords)
    const reqSentence = sentences.find(s => {
      const answer = getUniqueAnswer(s);
      return !usedAnswers.has(answer) && (
        s.toLowerCase().includes('should') || s.toLowerCase().includes('must') || 
        s.toLowerCase().includes('require') || s.toLowerCase().includes('recommend')
      );
    });
    if (reqSentence && questions.length < 5) {
      const answer = getUniqueAnswer(reqSentence);
      const question: { question: string; answer: string; evidence?: string; needsReview?: boolean } = {
        question: "What requirements or recommendations are stated?",
        answer: answer
      };
      
      if (isStrict) {
        question.evidence = getEvidence(reqSentence);
        if (!question.evidence.trim()) {
          question.needsReview = true;
        }
      }
      
      questions.push(question);
      usedAnswers.add(answer);
    }
    
    // Fill remaining slots with completely distinct sentences from different sections
    if (questions.length < 5) {
      const remainingSentences = sentences.filter(s => {
        const answer = getUniqueAnswer(s);
        return !usedAnswers.has(answer) && s.trim().length > 30;
      });
      
      // Select sentences from different parts of the text to ensure variety
      const step = Math.max(1, Math.floor(remainingSentences.length / (5 - questions.length + 1)));
      let index = 0;
      
      while (questions.length < 5 && index < remainingSentences.length) {
        const sentence = remainingSentences[index];
        const answer = getUniqueAnswer(sentence);
        
        if (!usedAnswers.has(answer)) {
          const question: { question: string; answer: string; evidence?: string; needsReview?: boolean } = {
            question: `What does the excerpt state about ${sentence.trim().split(' ').slice(0, 4).join(' ').toLowerCase()}?`,
            answer: answer
          };
          
          if (isStrict) {
            question.evidence = getEvidence(sentence);
            if (!question.evidence.trim()) {
              question.needsReview = true;
            }
          }
          
          questions.push(question);
          usedAnswers.add(answer);
        }
        index += step;
      }
    }
    
    return questions.slice(0, 5);
  };

  const generateTakeaways = (text: string): string[] => {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 15);
    const takeaways: string[] = [];
    
    // Extract key statements from the text
    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      if (trimmed.length > 30 && trimmed.length < 120) {
        // Look for sentences that contain key concepts
        if (trimmed.toLowerCase().includes('important') || 
            trimmed.toLowerCase().includes('key') ||
            trimmed.toLowerCase().includes('must') ||
            trimmed.toLowerCase().includes('should') ||
            trimmed.toLowerCase().includes('essential') ||
            trimmed.toLowerCase().includes('critical')) {
          takeaways.push(trimmed);
        }
      }
    });
    
    // If we don't have enough, add the first few substantive sentences
    const targetCount = strictMode ? Math.max(5, Math.min(7, takeaways.length + 5)) : 7;
    if (takeaways.length < (strictMode ? 5 : 5)) {
      const additionalTakeaways = sentences
        .filter(s => s.trim().length > 40 && s.trim().length < 100)
        .filter(s => !takeaways.includes(s.trim()))
        .slice(0, targetCount - takeaways.length);
      takeaways.push(...additionalTakeaways.map(s => s.trim()));
    }
    
    return strictMode ? takeaways.slice(0, 7) : takeaways.slice(0, 7);
  };

  const generateSummary = (text: string): string => {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const summaryParts: string[] = [];
    
    // Take key sentences from different parts of the text
    if (sentences.length >= 5) {
      summaryParts.push(sentences[0]?.trim()); // Opening statement
      summaryParts.push(sentences[Math.floor(sentences.length * 0.25)]?.trim()); // First quarter
      summaryParts.push(sentences[Math.floor(sentences.length * 0.5)]?.trim()); // Middle
      summaryParts.push(sentences[Math.floor(sentences.length * 0.75)]?.trim()); // Third quarter
      if (sentences.length > 1) {
        summaryParts.push(sentences[sentences.length - 1]?.trim()); // Closing statement
      }
    } else {
      // For shorter texts, use available sentences
      summaryParts.push(...sentences.map(s => s.trim()));
    }
    
    // In strict mode, ensure we have 4-8 sentences
    const filteredParts = summaryParts.filter(Boolean);
    if (strictMode) {
      const targetCount = Math.max(4, Math.min(8, filteredParts.length));
      return filteredParts.slice(0, targetCount).join('. ') + '.';
    }
    
    return filteredParts.slice(0, 6).join('. ') + '.';
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

    const markdownContent = strictMode ? 
      // Strict mode format with evidence
      `# ${cornellNote.title}
**Date:** ${cornellNote.date}  
**Module:** ${cornellNote.module}  

<!-- keywords:start -->
## Keywords
${cornellNote.keywords.map(keyword => `- ${keyword}`).join('\n')}
<!-- keywords:end -->

<!-- qa:start -->
## Questions & Answers
${cornellNote.questions.map((qa, index) => 
  `- **Q${index + 1}:** ${qa.question}
  <details><summary>Answer</summary>
  <p>${qa.answer}</p>
  <p><em>Evidence:</em> "${qa.evidence || 'Not provided'}"</p>
  </details>`
).join('\n\n')}
<!-- qa:end -->

<!-- takeaways:start -->
## Takeaways
${cornellNote.takeaways.map(takeaway => `- ${takeaway}`).join('\n')}
<!-- takeaways:end -->

<!-- summary:start -->
## Summary
${cornellNote.summary}
<!-- summary:end -->` :
      // Standard format  
      `# ${cornellNote.title}
**Date:** ${cornellNote.date}  
**Module:** ${cornellNote.module}  

<!-- keywords:start -->
## Keywords
${cornellNote.keywords.map(keyword => `- ${keyword}`).join('\n')}
<!-- keywords:end -->

<!-- qa:start -->
## Questions & Answers
${cornellNote.questions.map((qa, index) => 
  `- **Q${index + 1}:** ${qa.question}\n  <details><summary>Answer</summary><p>${qa.answer}</p></details>`
).join('\n\n')}
<!-- qa:end -->

<!-- takeaways:start -->
## Takeaways
${cornellNote.takeaways.map(takeaway => `- ${takeaway}`).join('\n')}
<!-- takeaways:end -->

<!-- summary:start -->
## Summary
${cornellNote.summary}
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
                placeholder="Paste your 1-2 page excerpt from the Agile Extension v2 here..."
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
                    <p className="text-sm text-muted-foreground">Requires evidence quotes for each Q&A item</p>
                  </div>
                </div>
                <Switch
                  id="strict-mode"
                  checked={strictMode}
                  onCheckedChange={setStrictMode}
                />
              </div>
              
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
                    <h4 className="font-semibold text-primary mb-2">Takeaways</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {cornellNote.takeaways.map((takeaway, index) => (
                        <li key={index}>{takeaway}</li>
                      ))}
                    </ul>
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
      </div>
    </div>
  );
}