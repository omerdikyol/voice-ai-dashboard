"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookText, FileText, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CallsTable } from "@/components/shared/calls-table";
import { EmptyBlock, ErrorBlock } from "@/components/shared/state-block";
import { PageHeader } from "@/components/shared/page-header";
import {
  createCall,
  getCallConsoleSettings,
  getCalls,
  getIntegrationStatus,
  previewPrompt,
  refreshCallStatus,
  updateCallConsoleSettings,
} from "@/lib/api";
import { formatLongDateTime } from "@/lib/format";
import type { CallConsoleSettings, CreateCallPayload, PromptPreview } from "@/lib/types";

const countryCodes = [
  { label: "Turkey (+90)", value: "+90" },
  { label: "United States (+1)", value: "+1" },
  { label: "United Kingdom (+44)", value: "+44" },
  { label: "Germany (+49)", value: "+49" },
];

const promptPresets = [
  {
    key: "collections",
    label: "Collections reminder",
    prompt:
      "You are Call Bank's collections specialist. Be concise, respectful, and practical. Confirm the customer's identity at a high level, explain the payment reminder clearly, and guide them toward the safest next step without pressure.",
    welcomeMessage: "Hello from Call Bank. I am calling with a quick payment reminder and next steps.",
  },
  {
    key: "fx-briefing",
    label: "FX market briefing",
    prompt:
      "You are Call Bank's treasury outreach assistant. Summarize the most relevant FX context for the customer, relate it to common business banking decisions, and keep the conversation actionable.",
    welcomeMessage: "Hello from Call Bank. I have a short market update that may help with your banking decisions today.",
  },
  {
    key: "product-followup",
    label: "Product follow-up",
    prompt:
      "You are Call Bank's relationship assistant. Follow up on product interest, highlight the most relevant benefit, and propose one clear next step the customer can take with the bank.",
    welcomeMessage: "Hello from Call Bank. I wanted to follow up with a quick update on a banking option that may fit your needs.",
  },
];

const defaultSettings: CallConsoleSettings = {
  voice: "callie",
  country_code: "+90",
  local_number: "5551234567",
  base_prompt:
    "You are Call Bank's outbound assistant. Keep the conversation warm, efficient, and practical. Help the customer understand why you called and guide them to the next best banking action.",
  welcome_message: "Hello from Call Bank. I have a quick update for you today.",
  inject_knowledge_base: false,
  inject_fx: true,
  inject_weather: true,
  top_k: 4,
};

const terminalStatuses = new Set(["completed", "no_answer", "busy", "voicemail", "failed"]);

export function CallConsolePage() {
  const queryClient = useQueryClient();
  const [voice, setVoice] = useState<"burcin" | "callie">(defaultSettings.voice);
  const [countryCode, setCountryCode] = useState(defaultSettings.country_code);
  const [localNumber, setLocalNumber] = useState(defaultSettings.local_number);
  const [basePrompt, setBasePrompt] = useState(defaultSettings.base_prompt);
  const [welcomeMessage, setWelcomeMessage] = useState(defaultSettings.welcome_message);
  const [injectKnowledgeBase, setInjectKnowledgeBase] = useState(defaultSettings.inject_knowledge_base);
  const [injectFx, setInjectFx] = useState(defaultSettings.inject_fx);
  const [injectWeather, setInjectWeather] = useState(defaultSettings.inject_weather);
  const [topK, setTopK] = useState(defaultSettings.top_k);
  const [editorView, setEditorView] = useState<"base" | "injected">("base");
  const [previewData, setPreviewData] = useState<PromptPreview | null>(null);
  const [previewSourceKey, setPreviewSourceKey] = useState("");
  const [latestProviderResponse, setLatestProviderResponse] = useState<Record<string, unknown> | null>(null);
  const [presetKey, setPresetKey] = useState(promptPresets[0].key);
  const [hydratedSettings, setHydratedSettings] = useState(false);
  const [refreshingIds, setRefreshingIds] = useState<string[]>([]);

  const settingsQuery = useQuery({
    queryKey: ["call-console-settings"],
    queryFn: getCallConsoleSettings,
  });

  const historyQuery = useQuery({
    queryKey: ["manual-calls"],
    queryFn: () => getCalls("manual"),
  });

  const integrationsQuery = useQuery({
    queryKey: ["integrations-status"],
    queryFn: getIntegrationStatus,
  });

  const settingsMutation = useMutation({
    mutationFn: updateCallConsoleSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(["call-console-settings"], data);
    },
  });

  const previewMutation = useMutation({
    mutationFn: (nextPayload: CreateCallPayload) => previewPrompt(nextPayload),
  });

  const callMutation = useMutation({
    mutationFn: (nextPayload: CreateCallPayload) => createCall(nextPayload),
  });

  useEffect(() => {
    if (!settingsQuery.data || hydratedSettings) return;
    setVoice(settingsQuery.data.voice);
    setCountryCode(settingsQuery.data.country_code);
    setLocalNumber(settingsQuery.data.local_number);
    setBasePrompt(settingsQuery.data.base_prompt);
    setWelcomeMessage(settingsQuery.data.welcome_message);
    setInjectKnowledgeBase(settingsQuery.data.inject_knowledge_base);
    setInjectFx(settingsQuery.data.inject_fx);
    setInjectWeather(settingsQuery.data.inject_weather);
    setTopK(settingsQuery.data.top_k);
    setHydratedSettings(true);
  }, [hydratedSettings, settingsQuery.data]);

  const persistedSettings = useMemo<CallConsoleSettings>(
    () => ({
      voice,
      country_code: countryCode,
      local_number: localNumber,
      base_prompt: basePrompt,
      welcome_message: welcomeMessage,
      inject_knowledge_base: injectKnowledgeBase,
      inject_fx: injectFx,
      inject_weather: injectWeather,
      top_k: topK,
    }),
    [basePrompt, countryCode, injectFx, injectKnowledgeBase, injectWeather, localNumber, topK, voice, welcomeMessage],
  );

  useEffect(() => {
    if (!hydratedSettings) return;
    const handle = window.setTimeout(() => {
      settingsMutation.mutate(persistedSettings);
    }, 650);
    return () => window.clearTimeout(handle);
  }, [hydratedSettings, persistedSettings, settingsMutation]);

  const payload = useMemo<CreateCallPayload>(
    () => ({
      voice,
      prompt: basePrompt,
      welcome_message: welcomeMessage,
      phone_number: `${countryCode}${localNumber.replace(/\D/g, "")}`,
      inject_knowledge_base: injectKnowledgeBase,
      inject_fx: injectFx,
      inject_weather: injectWeather,
      top_k: topK,
    }),
    [basePrompt, countryCode, injectFx, injectKnowledgeBase, injectWeather, localNumber, topK, voice, welcomeMessage],
  );

  const payloadKey = useMemo(() => JSON.stringify(payload), [payload]);
  const isPreviewStale = !!previewData && previewSourceKey !== payloadKey;
  const activePollTargets = useMemo(
    () =>
      (historyQuery.data ?? [])
        .filter((call) => call.source === "manual" && !terminalStatuses.has(call.status))
        .filter((call) => call.provider_status_available || !call.status_last_checked_at)
        .map((call) => call.id),
    [historyQuery.data],
  );

  const handleRefreshStatus = useCallback(async (callId: string, silent = false) => {
    setRefreshingIds((current) => (current.includes(callId) ? current : [...current, callId]));
    try {
      const refreshed = await refreshCallStatus(callId);
      queryClient.setQueryData(["manual-calls"], (existing: Awaited<ReturnType<typeof getCalls>> | undefined) =>
        (existing ?? []).map((call) => (call.id === refreshed.id ? refreshed : call)),
      );
      if (!silent) {
        toast.success(refreshed.status_detail ?? "Call status refreshed.");
      }
    } catch (error) {
      if (!silent) {
        toast.error((error as Error).message);
      }
    } finally {
      setRefreshingIds((current) => current.filter((id) => id !== callId));
    }
  }, [queryClient]);

  useEffect(() => {
    if (!activePollTargets.length) return;
    const interval = window.setInterval(() => {
      activePollTargets.forEach((callId) => {
        void handleRefreshStatus(callId, true);
      });
    }, 15000);
    return () => window.clearInterval(interval);
  }, [activePollTargets, handleRefreshStatus]);

  async function handlePreview(nextPayload: CreateCallPayload) {
    try {
      const data = await previewMutation.mutateAsync(nextPayload);
      setPreviewData(data);
      setPreviewSourceKey(JSON.stringify(nextPayload));
      setEditorView("injected");
      toast.success("Prompt preview updated.");
      return data;
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    }
  }

  async function handleMakeCall() {
    try {
      if (!previewData || isPreviewStale) {
        await handlePreview(payload);
      }
      const response = await callMutation.mutateAsync(payload);
      setPreviewData(response.prompt_preview);
      setPreviewSourceKey(payloadKey);
      setLatestProviderResponse(response.provider_response);
      queryClient.setQueryData(["manual-calls"], (existing: Awaited<ReturnType<typeof getCalls>> | undefined) => [
        response.call,
        ...(existing ?? []).filter((call) => call.id !== response.call.id),
      ]);
      toast.success("Call request sent through the backend.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  function applyPreset() {
    const preset = promptPresets.find((item) => item.key === presetKey);
    if (!preset) return;
    setBasePrompt(preset.prompt);
    setWelcomeMessage(preset.welcomeMessage);
    setEditorView("base");
    toast.success("Preset applied to the base prompt.");
  }

  function applyInjectedPrompt() {
    if (!previewData) return;
    setBasePrompt(previewData.final_prompt);
    setEditorView("base");
    toast.success("Injected prompt copied into the editable draft.");
  }

  const saveTimestamp = settingsMutation.data?.updated_at ?? settingsQuery.data?.updated_at;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Outbound Console"
        title="Assemble context before the dial"
        description="Persist the operator defaults, inspect the injected prompt in the main editor flow, and keep outbound calls visible while the backend checks for status updates."
        badge={saveTimestamp ? `Saved ${formatLongDateTime(saveTimestamp)}` : "Saving defaults locally"}
      />

      {settingsQuery.error ? <ErrorBlock message={(settingsQuery.error as Error).message} /> : null}

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-[28px] border-border/70 glass-card">
          <CardHeader className="space-y-2">
            <CardTitle className="font-heading text-2xl tracking-tight">Call setup</CardTitle>
            <p className="text-sm leading-7 text-muted-foreground">
              The backend owns provider keys, persists your defaults, assembles the final prompt, and stores every call attempt with prompt context.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <Field label="Saved preset">
                <Select value={presetKey} onValueChange={(value) => value && setPresetKey(value)}>
                  <SelectTrigger className="rounded-2xl bg-background/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {promptPresets.map((preset) => (
                      <SelectItem key={preset.key} value={preset.key}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="pt-6">
                <Button type="button" variant="outline" className="rounded-full" onClick={applyPreset}>
                  Apply preset
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_1fr_140px]">
              <Field label="Voice">
                <Select value={voice} onValueChange={(value) => value && setVoice(value as "burcin" | "callie")}>
                  <SelectTrigger className="rounded-2xl bg-background/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="callie">Callie</SelectItem>
                    <SelectItem value="burcin">Burcin</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Phone number">
                <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-2">
                  <Select value={countryCode} onValueChange={(value) => value && setCountryCode(value)}>
                    <SelectTrigger className="rounded-2xl bg-background/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {countryCodes.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={localNumber}
                    onChange={(event) => setLocalNumber(event.target.value)}
                    className="rounded-2xl bg-background/80"
                    placeholder="5551234567"
                  />
                </div>
              </Field>

              <Field label="Top K">
                <Select value={String(topK)} onValueChange={(value) => setTopK(Number(value))}>
                  <SelectTrigger className="rounded-2xl bg-background/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 4, 6, 8].map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value} chunks
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Welcome message">
              <Input
                value={welcomeMessage}
                onChange={(event) => setWelcomeMessage(event.target.value)}
                className="rounded-2xl bg-background/80"
              />
            </Field>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  Prompt editor
                </Label>
                <div className="flex items-center gap-2">
                  {previewData ? (
                    <Badge variant={isPreviewStale ? "outline" : "secondary"} className="rounded-full">
                      {isPreviewStale ? "Preview stale" : "Preview ready"}
                    </Badge>
                  ) : null}
                  {previewMutation.isPending ? (
                    <Badge variant="outline" className="rounded-full">
                      <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Building preview
                    </Badge>
                  ) : null}
                </div>
              </div>

              <Tabs value={editorView} onValueChange={(value) => setEditorView(value as "base" | "injected")}>
                <TabsList className="rounded-full">
                  <TabsTrigger value="base">Base view</TabsTrigger>
                  <TabsTrigger value="injected" disabled={!previewData}>
                    Injected view
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="base" className="mt-3">
                  <Textarea
                    value={basePrompt}
                    onChange={(event) => setBasePrompt(event.target.value)}
                    className="min-h-[220px] rounded-[24px] bg-background/80"
                  />
                </TabsContent>
                <TabsContent value="injected" className="mt-3">
                  {previewData ? (
                    <Textarea
                      value={previewData.final_prompt}
                      readOnly
                      className="min-h-[220px] rounded-[24px] bg-slate-950 font-mono text-xs leading-6 text-slate-100"
                    />
                  ) : (
                    <EmptyBlock
                      title="No injected prompt yet"
                      description="Generate a preview to inspect the exact enriched prompt in this editor panel."
                    />
                  )}
                </TabsContent>
              </Tabs>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <ToggleRow
                label="Knowledge Base"
                description="Retrieve and inject the most relevant document chunks."
                checked={injectKnowledgeBase}
                onCheckedChange={setInjectKnowledgeBase}
              />
              <ToggleRow
                label="FX Rates"
                description="Inject TRY, USD, EUR, and GBP market context."
                checked={injectFx}
                onCheckedChange={setInjectFx}
              />
              <ToggleRow
                label="Weather"
                description="Inject the current weather snapshot for the configured city."
                checked={injectWeather}
                onCheckedChange={setInjectWeather}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void handlePreview(payload)} disabled={previewMutation.isPending} className="rounded-full">
                <Sparkles className="mr-2 h-4 w-4" />
                Preview final prompt
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={applyInjectedPrompt}
                disabled={!previewData}
                className="rounded-full"
              >
                <FileText className="mr-2 h-4 w-4" />
                Apply injected prompt
              </Button>
              <Sheet>
                <SheetTrigger
                  render={
                    <Button type="button" variant="outline" className="rounded-full" disabled={!previewData?.citations.length} />
                  }
                >
                  <BookText className="mr-2 h-4 w-4" />
                  Retrieval citations
                </SheetTrigger>
                <SheetContent side="right" className="w-full max-w-xl">
                  <SheetHeader>
                    <SheetTitle>Retrieved citations</SheetTitle>
                    <SheetDescription>
                      Inspect which chunks were injected before the call was sent or previewed.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="space-y-3 overflow-auto px-4 pb-4">
                    {previewData?.citations.length ? (
                      previewData.citations.map((citation) => (
                        <div key={citation.chunk_id} className="rounded-[24px] border border-border/70 bg-background/80 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium text-foreground">{citation.document_name}</p>
                            <Badge variant="secondary" className="rounded-full">
                              Score {citation.score}
                            </Badge>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-muted-foreground">{citation.excerpt}</p>
                        </div>
                      ))
                    ) : (
                      <EmptyBlock title="No citations yet" description="Enable the Knowledge Base toggle and preview again." />
                    )}
                  </div>
                </SheetContent>
              </Sheet>
              <Button
                variant="secondary"
                onClick={() => void handleMakeCall()}
                disabled={callMutation.isPending || previewMutation.isPending}
                className="rounded-full"
              >
                {callMutation.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                Make call
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-[28px] border-border/70 glass-card">
            <CardHeader className="space-y-2">
              <CardTitle className="font-heading text-xl tracking-tight">Integration health</CardTitle>
              <p className="text-sm leading-7 text-muted-foreground">
                Backend-side prompt enrichers currently wired into the call flow.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {integrationsQuery.data?.providers.map((provider) => (
                <div
                  key={provider.provider}
                  className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-4 py-3"
                >
                  <div>
                    <p className="font-medium capitalize">{provider.provider.replace("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">{provider.detail}</p>
                  </div>
                  <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                    {provider.healthy ? "Healthy" : "Unavailable"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-border/70 glass-card">
            <CardHeader className="space-y-2">
              <CardTitle className="font-heading text-xl tracking-tight">Prompt assembly</CardTitle>
              <p className="text-sm leading-7 text-muted-foreground">
                The preview is shown inline in the editor, and each section stays inspectable here with source metadata.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {previewData ? (
                previewData.sections.map((section) => (
                  <div key={`${section.title}-${section.type}`} className="rounded-[24px] border border-border/70 bg-background/75 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{section.title}</p>
                      <Badge variant="outline" className="rounded-full capitalize">
                        {section.type.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-3 line-clamp-4 text-sm leading-6 text-muted-foreground">{section.content}</p>
                  </div>
                ))
              ) : (
                <EmptyBlock
                  title="No preview sections yet"
                  description="Generate a preview to inspect base, retrieval, integration, and guardrail sections."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {callMutation.error ? <ErrorBlock message={(callMutation.error as Error).message} /> : null}

      <Card className="rounded-[28px] border-border/70 glass-card">
        <CardHeader className="space-y-2">
          <CardTitle className="font-heading text-2xl tracking-tight">Call history</CardTitle>
          <p className="text-sm leading-7 text-muted-foreground">
            Persisted outbound console activity, including provider detail and the last backend status check.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="history">
            <TabsList className="mb-4 rounded-full">
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="provider">Last provider response</TabsTrigger>
            </TabsList>
            <TabsContent value="history">
              {historyQuery.data?.length ? (
                <CallsTable calls={historyQuery.data} onRefreshStatus={(callId) => void handleRefreshStatus(callId)} refreshingIds={refreshingIds} />
              ) : (
                <EmptyBlock title="No outbound calls yet" description="Trigger the first call to populate history." />
              )}
            </TabsContent>
            <TabsContent value="provider">
              <pre className="overflow-auto rounded-[24px] bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
                {JSON.stringify(latestProviderResponse ?? {}, null, 2)}
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between rounded-[24px] border border-border/70 bg-background/80 p-4">
      <div className="pr-4">
        <p className="font-medium text-foreground">{label}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
