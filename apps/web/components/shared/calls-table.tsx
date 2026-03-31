import Link from "next/link";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCompactDateTime, formatLongDateTime } from "@/lib/format";
import { CallRecord } from "@/lib/types";

const TERMINAL_STATUSES = new Set(["completed", "no_answer", "busy", "voicemail", "failed"]);

export function CallsTable({
  calls,
  onRefreshStatus,
  refreshingIds = [],
}: {
  calls: CallRecord[];
  onRefreshStatus?: (callId: string) => void;
  refreshingIds?: string[];
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-border/70">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Counterparty</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Topic</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Recording</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call) => (
            <TableRow key={call.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {formatCompactDateTime(call.started_at ?? call.created_at)}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="font-medium text-foreground">
                    {call.contact_name ?? call.phone_number ?? "Unknown"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {call.phone_number ?? "No number"}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="cursor-default">
                        <Badge variant="secondary" className="rounded-full capitalize">
                          {call.status.replace("_", " ")}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        {call.status_detail ?? "No additional provider detail yet."}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {call.status_last_checked_at ? (
                    <span className="text-[11px] text-muted-foreground">
                      Checked {formatLongDateTime(call.status_last_checked_at)}
                    </span>
                  ) : null}
                  {onRefreshStatus && shouldShowRefresh(call) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => onRefreshStatus(call.id)}
                      disabled={refreshingIds.includes(call.id)}
                    >
                      <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshingIds.includes(call.id) ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="max-w-[220px] truncate text-muted-foreground">
                {call.topic ?? call.transcript_preview ?? "Manual outbound call"}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {call.tags.length ? (
                    call.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="rounded-full">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No tags</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {call.recording_url ? (
                  <Link
                    href={call.recording_url}
                    target="_blank"
                    className="inline-flex items-center gap-2 text-sm text-primary"
                  >
                    Open
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">Unavailable</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function shouldShowRefresh(call: CallRecord) {
  if (call.source !== "manual") return false;
  if (TERMINAL_STATUSES.has(call.status)) return false;
  if (!call.provider_status_available && call.status_last_checked_at) return false;
  return true;
}
