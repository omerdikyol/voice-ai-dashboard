"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { deleteDocument, getDocuments, uploadDocument } from "@/lib/api";
import { formatBytes, formatLongDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyBlock, ErrorBlock } from "@/components/shared/state-block";

export function KnowledgeBasePage() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);

  const documentsQuery = useQuery({
    queryKey: ["knowledge-documents"],
    queryFn: getDocuments,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadDocument(file, (value) => {
        setProgress(value);
      }),
    onSuccess: () => {
      setProgress(100);
      toast.success("Document processed and indexed.");
      void queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
      setTimeout(() => setProgress(0), 1200);
    },
    onError: (error) => {
      toast.error((error as Error).message);
      setProgress(0);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => deleteDocument(documentId),
    onSuccess: () => {
      toast.success("Document removed.");
      void queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
    },
    onError: (error) => {
      toast.error((error as Error).message);
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const [file] = acceptedFiles;
      if (!file) return;
      uploadMutation.mutate(file);
    },
    [uploadMutation],
  );

  const dropzone = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Retrieval Workspace"
        title="Ingest the bank's reference material"
        description="Drag in PDF or DOCX files, chunk them, embed them, and keep them ready for prompt-time retrieval. The backend stores the raw file metadata, chunk count, and vectorized content."
      />

      <Card className="rounded-[28px] border-border/70 glass-card">
        <CardHeader className="space-y-2">
          <CardTitle className="font-heading text-2xl tracking-tight">Document upload</CardTitle>
          <p className="text-sm leading-7 text-muted-foreground">
            Upload loan scripts, compliance notes, FAQ sheets, or product guides. Retrieval uses the call prompt as the search query.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...dropzone.getRootProps()}
            className="rounded-[28px] border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-12 text-center transition hover:border-primary/50 hover:bg-primary/8"
          >
            <input {...dropzone.getInputProps()} />
            <UploadCloud className="mx-auto h-10 w-10 text-primary" />
            <h3 className="mt-4 font-heading text-2xl font-semibold tracking-tight">
              Drop a PDF or DOCX here
            </h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Or click to browse files. The backend will extract text, chunk it, embed it, and persist both metadata and vectors.
            </p>
          </div>
          {progress > 0 ? <Progress value={progress} className="h-2" /> : null}
        </CardContent>
      </Card>

      {documentsQuery.error ? <ErrorBlock message={(documentsQuery.error as Error).message} /> : null}

      <Card className="rounded-[28px] border-border/70 glass-card">
        <CardHeader className="space-y-2">
          <CardTitle className="font-heading text-2xl tracking-tight">Indexed documents</CardTitle>
          <p className="text-sm leading-7 text-muted-foreground">
            Stored files remain available after restart because the database and upload volume are persisted locally.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {documentsQuery.data?.length ? (
            documentsQuery.data.map((document) => (
              <div
                key={document.id}
                className="flex flex-col gap-4 rounded-[24px] border border-border/70 bg-background/75 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{document.filename}</p>
                    <Badge variant="secondary" className="rounded-full capitalize">
                      {document.status}
                    </Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {formatBytes(document.byte_size)} · {document.chunk_count} chunks · Updated {formatLongDateTime(document.updated_at)}
                  </p>
                  {document.error_message ? (
                    <p className="text-sm text-destructive">{document.error_message}</p>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => deleteMutation.mutate(document.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            ))
          ) : (
            <EmptyBlock title="No documents indexed yet" description="Upload the first reference file to enable retrieval-backed prompt injection." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
