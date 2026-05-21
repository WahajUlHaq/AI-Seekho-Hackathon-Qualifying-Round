"use client";

import { useId } from "react";
import { TriangleAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Props = {
  url: string;
  description: string;
  onUrlChange: (next: string) => void;
  onDescriptionChange: (next: string) => void;
};

export function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function UrlInputForm({ url, description, onUrlChange, onDescriptionChange }: Props) {
  const urlId = useId();
  const descId = useId();
  const showError = url.length > 0 && !isValidHttpUrl(url);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit a web source</CardTitle>
        <CardDescription>
          Paste a public URL the agent should ingest. Add an optional description to steer the constraints layer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={urlId}>Source URL</Label>
          <Input
            id={urlId}
            type="url"
            inputMode="url"
            placeholder="https://example.com/article"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            aria-invalid={showError || undefined}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={descId}>Description (optional)</Label>
          <Textarea
            id={descId}
            placeholder="Short note on what to extract or prioritize"
            rows={3}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
          />
        </div>

        {showError ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Invalid URL</AlertTitle>
            <AlertDescription>
              URL must start with <code>http://</code> or <code>https://</code>.
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
