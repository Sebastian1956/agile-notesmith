import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, FileText, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CornellNote {
  title: string;
  date: string;
  module: string;
  keywords: string[];
  questions: Array<{ question: string; answer: string }>;
  takeaways: string[];
  summary: string;
}

export function CornellNoteGenerator() {
  const [excerpt, setExcerpt] = useState("");
  const [cornellNote, setCornellNote] = useState<CornellNote | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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
        questions: generateQuestions(excerpt),
        takeaways: generateTakeaways(excerpt),
        summary: generateSummary(excerpt)
      };

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
    
    // Sort by frequency and take top terms
    const sortedTerms = Object.entries(termCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 6)
      .map(([term]) => term);
    
    return sortedTerms.length >= 5 ? sortedTerms : 
      [...sortedTerms, ...words.filter(w => w.length > 6).slice(0, 6 - sortedTerms.length)];
  };

  const generateQuestions = (text: string): Array<{ question: string; answer: string }> => {
    // Generate questions that can be answered directly from the excerpt
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const questions = [
      {
        question: "What is the main topic discussed in this excerpt?",
        answer: sentences[0]?.trim() || "The excerpt discusses business analysis concepts."
      },
      {
        question: "What key concept or approach is emphasized?",
        answer: sentences.find(s => s.toLowerCase().includes('approach') || s.toLowerCase().includes('method') || s.toLowerCase().includes('practice'))?.trim() || sentences[1]?.trim() || "Key practices are outlined."
      },
      {
        question: "What benefits or outcomes are mentioned?",
        answer: sentences.find(s => s.toLowerCase().includes('benefit') || s.toLowerCase().includes('value') || s.toLowerCase().includes('outcome'))?.trim() || sentences[2]?.trim() || "Benefits are described in the text."
      },
      {
        question: "What challenges or considerations are addressed?",
        answer: sentences.find(s => s.toLowerCase().includes('challenge') || s.toLowerCase().includes('consider') || s.toLowerCase().includes('important'))?.trim() || sentences[3]?.trim() || "Important considerations are noted."
      },
      {
        question: "What recommendation or guidance is provided?",
        answer: sentences.find(s => s.toLowerCase().includes('should') || s.toLowerCase().includes('recommend') || s.toLowerCase().includes('must'))?.trim() || sentences[sentences.length - 1]?.trim() || "Specific guidance is provided."
      }
    ];

    return questions;
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
    if (takeaways.length < 5) {
      const additionalTakeaways = sentences
        .filter(s => s.trim().length > 40 && s.trim().length < 100)
        .slice(0, 7 - takeaways.length);
      takeaways.push(...additionalTakeaways.map(s => s.trim()));
    }
    
    return takeaways.slice(0, 7);
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
      summaryParts.push(sentences[sentences.length - 1]?.trim()); // Closing statement
    } else {
      // For shorter texts, use available sentences
      summaryParts.push(...sentences.map(s => s.trim()));
    }
    
    return summaryParts.filter(Boolean).slice(0, 6).join('. ') + '.';
  };

  const copyToClipboard = () => {
    if (!cornellNote) return;

    const markdownContent = `# ${cornellNote.title}
**Date:** ${cornellNote.date}  
**Module:** ${cornellNote.module}  

<!-- keywords:start -->
## Keywords
${cornellNote.keywords.map(keyword => `- ${keyword}`).join('\n')}
<!-- keywords:end -->

<!-- qa:start -->
## Questions & Answers
${cornellNote.questions.map((qa, index) => 
  `- **Q${index + 1}:** ${qa.question}\n  <details><summary>Answer</summary>${qa.answer}</details>`
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
                className="min-h-[400px] resize-none border-border/50 focus:border-primary transition-smooth"
              />
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
                    className="hover:bg-primary hover:text-primary-foreground transition-smooth"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cornellNote ? (
                <div className="space-y-6 text-sm">
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
                        <div key={index} className="pl-4 border-l-2 border-accent/30">
                          <p className="font-medium">Q{index + 1}: {qa.question}</p>
                          <p className="text-muted-foreground mt-1 italic">Answer: {qa.answer}</p>
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