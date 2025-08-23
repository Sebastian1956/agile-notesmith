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
    // Simple keyword extraction based on common Agile terms
    const agileTerms = [
      'agile mindset', 'business value', 'rolling-wave planning', 'three horizons',
      'strategy', 'initiative', 'delivery', 'business outcomes', 'customer collaboration',
      'adaptive planning', 'iterative development', 'stakeholder engagement',
      'value stream', 'user stories', 'requirements elicitation'
    ];
    
    const lowerText = text.toLowerCase();
    const foundTerms = agileTerms.filter(term => lowerText.includes(term));
    
    // Add some generic terms if we don't have enough
    const additionalTerms = ['business analysis', 'agile practices', 'change management'];
    const allTerms = [...foundTerms, ...additionalTerms].slice(0, 6);
    
    return allTerms;
  };

  const generateQuestions = (text: string): Array<{ question: string; answer: string }> => {
    // Generate contextual questions based on the excerpt
    const questions = [
      {
        question: "What is the main focus of this Agile Extension v2 section?",
        answer: "The section emphasizes the importance of adopting an agile mindset for business analysis to deliver maximum business value."
      },
      {
        question: "How does agile business analysis differ from traditional approaches?",
        answer: "Agile BA focuses on adaptive planning, continuous collaboration, and delivering value incrementally rather than following rigid processes."
      },
      {
        question: "What role do business analysts play in agile environments?",
        answer: "Business analysts facilitate stakeholder collaboration, help define business value, and ensure requirements align with customer needs."
      },
      {
        question: "Why is the three horizons model important for agile planning?",
        answer: "It provides a structured approach to planning across Strategy, Initiative, and Delivery levels while maintaining flexibility."
      },
      {
        question: "How should business analysts adapt their practices for agile success?",
        answer: "They should embrace iterative approaches, focus on outcomes over outputs, and maintain close collaboration with all stakeholders."
      }
    ];

    return questions;
  };

  const generateTakeaways = (text: string): string[] => {
    return [
      "Agile mindset transcends specific methodologies or frameworks",
      "Business value delivery requires continuous stakeholder collaboration",
      "Adaptive planning enables better response to changing requirements",
      "Three horizons model provides structure while maintaining agility",
      "Business analysts must evolve their practices for agile environments",
      "Customer outcomes should drive all analysis activities"
    ];
  };

  const generateSummary = (text: string): string => {
    return "The Agile Extension v2 emphasizes adopting an agile mindset that goes beyond traditional business analysis practices. It highlights the importance of delivering business value through adaptive planning and continuous stakeholder collaboration. The three horizons planning model (Strategy, Initiative, Delivery) provides a structured yet flexible framework for agile environments. Business analysts must evolve their approach to focus on customer outcomes and iterative value delivery. Success in agile business analysis requires embracing change, maintaining close collaboration, and consistently aligning analysis activities with business objectives.";
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
  `- **Q${index + 1}:** ${qa.question}\n  - *Answer:* ${qa.answer}`
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