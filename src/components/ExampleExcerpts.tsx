import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { sampleExcerpts } from "@/data/sampleExcerpts";

interface ExampleExcerptsProps {
  onExcerptSelect: (content: string) => void;
}

export const ExampleExcerpts = ({ onExcerptSelect }: ExampleExcerptsProps) => {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground mb-2">Try These Sample Excerpts</h3>
        <p className="text-sm text-muted-foreground">
          Click any example below to see how the Cornell Note Generator works
        </p>
      </div>
      
      <div className="grid gap-3 max-h-80 overflow-y-auto pr-2">
        {sampleExcerpts.map((excerpt, index) => (
          <Card key={index} className="transition-smooth hover:shadow-soft cursor-pointer border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-foreground">
                  {excerpt.title}
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  Sample {index + 1}
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground line-clamp-2">
                {excerpt.content.substring(0, 120)}...
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExcerptSelect(excerpt.content)}
                className="w-full text-xs transition-smooth hover:bg-accent hover:text-accent-foreground"
              >
                Use This Example
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};