// In-browser mock backend used by the GitHub Pages demo (NEXT_PUBLIC_DEMO_MODE=1).
// Every record here is generated: names, numbers, transcripts and documents are fictional.
// Aggregations mirror apps/api/app/services/analytics.py so the charts behave like the real API.
import type {
  CallConsoleSettings,
  CallRecord,
  CreateCallPayload,
  CreateCallResponse,
  DashboardSummary,
  DashboardTimeseries,
  DocumentRecord,
  IntegrationStatus,
  PromptPreview,
} from "@/lib/types";
import type { FilterParams } from "@/lib/api";

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
const rand = rng(42);
const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)];

const FIRST = ["Deniz", "Ece", "Mert", "Selin", "Kaan", "Zeynep", "Arda", "Elif", "Can", "Ada", "Emre", "Nil"];
const LAST = ["Demo", "Sample", "Example", "Placeholder", "Test", "Mock"];
const TOPICS = ["Card activation", "Loan inquiry", "Payment reminder", "Fraud alert", "Account update", "FX question", "Appointment"];
const OUTCOMES = ["resolved", "callback_scheduled", "escalated", "no_action", "payment_promised"];
const TAGS = ["vip", "follow-up", "new-customer", "retention", "campaign-q4", "complaint"];
const STATUSES = ["completed", "completed", "completed", "completed", "failed", "no_answer", "busy", "voicemail"];
const VOICES = ["burcin", "callie"];
const PREVIEWS: Record<string, string> = {
  positive: "Customer confirmed the details and thanked the agent for the quick help.",
  neutral: "Customer asked for the information to be sent by SMS and will review it later.",
  negative: "Customer was unhappy with the wait time and asked to speak with a supervisor.",
};

function sentimentFor(score: number) {
  if (score > 0.25) return "positive";
  if (score < -0.25) return "negative";
  return "neutral";
}

function makeCall(index: number, startedAt: Date, overrides: Partial<CallRecord> = {}): CallRecord {
  const status = pick(STATUSES);
  const answered = status === "completed";
  const duration = answered ? 40 + Math.floor(rand() * 420) : Math.floor(rand() * 25);
  const score = answered ? Math.round((rand() * 2 - 1) * 1000) / 1000 : null;
  const sentiment = score === null ? null : sentimentFor(score);
  const ended = new Date(startedAt.getTime() + duration * 1000);
  return {
    id: `demo-${index}`,
    external_call_id: `mock-${100000 + index}`,
    source: "mock",
    contact_name: `${pick(FIRST)} ${pick(LAST)}`,
    phone_number: `+90 555 000 ${String(index % 100).padStart(2, "0")} ${String((index * 7) % 100).padStart(2, "0")}`,
    direction: rand() < 0.7 ? "outbound" : "inbound",
    status,
    started_at: startedAt.toISOString(),
    ended_at: ended.toISOString(),
    created_at: startedAt.toISOString(),
    duration_seconds: duration,
    duration_display: `${Math.floor(duration / 60)}m ${duration % 60}s`,
    sentiment,
    sentiment_score: score,
    topic: pick(TOPICS),
    outcome: answered ? pick(OUTCOMES) : null,
    agent_name: "Demo Agent",
    voice_used: pick(VOICES),
    transcript_preview: sentiment ? PREVIEWS[sentiment] : null,
    recording_url: null,
    tags: TAGS.filter(() => rand() < 0.22),
    cost_credits: Math.round((duration / 60) * 0.35 * 100) / 100,
    provider_response: { demo: true },
    status_detail: null,
    status_last_checked_at: null,
    provider_status_available: false,
    ...overrides,
  };
}

const NOW = Date.now();
let calls: CallRecord[] = Array.from({ length: 240 }, (_, i) => {
  const daysAgo = Math.floor(rand() * 60);
  const hour = 8 + Math.floor(rand() * 11);
  const date = new Date(NOW - daysAgo * 86400000);
  date.setHours(hour, Math.floor(rand() * 60), 0, 0);
  return makeCall(i, date);
}).sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""));

let documents: DocumentRecord[] = [
  doc("kb-1", "product-faq.md", "text/markdown", 18_432, 24, 9),
  doc("kb-2", "card-fees-2026.pdf", "application/pdf", 412_000, 61, 6),
  doc("kb-3", "call-script-guidelines.txt", "text/plain", 6_210, 8, 3),
];

function doc(id: string, filename: string, mime: string, size: number, chunks: number, daysAgo: number): DocumentRecord {
  const at = new Date(NOW - daysAgo * 86400000).toISOString();
  return {
    id, filename, mime_type: mime, byte_size: size, status: "ready", chunk_count: chunks,
    status_message: "Indexed (demo data)", error_message: null,
    processing_started_at: at, processed_at: at, uploaded_at: at, updated_at: at,
  };
}

let settings: CallConsoleSettings = {
  voice: "callie",
  country_code: "+90",
  local_number: "5550000000",
  base_prompt: "You are a friendly bank assistant. Confirm the customer's request and keep answers short.",
  welcome_message: "Hello, this is the demo assistant calling from Example Bank.",
  inject_knowledge_base: true,
  inject_fx: true,
  inject_weather: false,
  top_k: 3,
  updated_at: new Date(NOW).toISOString(),
};

const delay = <T,>(value: T, ms = 250) => new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));

function filterCalls(f: Partial<FilterParams> & { source?: string; limit?: number }) {
  const floor = NOW - (f.days || 0) * 86400000;
  let out = calls.filter(
    (c) =>
      (!f.days || new Date(c.started_at ?? c.created_at).getTime() >= floor) &&
      (!f.status || f.status === "all" || c.status === f.status) &&
      (!f.voice || f.voice === "all" || c.voice_used === f.voice) &&
      (!f.direction || f.direction === "all" || c.direction === f.direction) &&
      (!f.sentiment || f.sentiment === "all" || c.sentiment === f.sentiment) &&
      (!f.topic || f.topic === "all" || c.topic === f.topic) &&
      (!f.tag || f.tag === "all" || c.tags.includes(f.tag)) &&
      (!f.source || c.source === f.source),
  );
  if (f.limit) out = out.slice(0, f.limit);
  return out;
}

function count<T>(items: T[]) {
  const m = new Map<T, number>();
  for (const item of items) m.set(item, (m.get(item) ?? 0) + 1);
  return m;
}
const entries = (m: Map<string, number>) => [...m].map(([key, count]) => ({ key, count }));
const top = (m: Map<string, number>, n = 8) => entries(m).sort((a, b) => b.count - a.count).slice(0, n);
const uniq = (items: (string | null)[]) => [...new Set(items.filter(Boolean) as string[])].sort();

export async function getDashboardSummary(filters: FilterParams): Promise<DashboardSummary> {
  const list = filterCalls(filters);
  const n = list.length;
  const byStatus = count(list.map((c) => c.status));
  const byDirection = count(list.flatMap((c) => (c.direction ? [c.direction] : [])));
  const totalDuration = list.reduce((s, c) => s + (c.duration_seconds ?? 0), 0);
  const avg = n ? Math.floor(totalDuration / n) : 0;
  const pct = (v: number) => (n ? Math.round((v / n) * 1000) / 10 : 0);
  return delay({
    generated_at: new Date().toISOString(),
    synced_at: new Date(NOW).toISOString(),
    cards: [
      { label: "Total calls", value: n, tone: "default" },
      { label: "Completion rate", value: `${pct(byStatus.get("completed") ?? 0)}%`, tone: "success" },
      { label: "Average duration", value: `${Math.floor(avg / 60)}m ${avg % 60}s`, tone: "default" },
      { label: "Total cost", value: Math.round(list.reduce((s, c) => s + (c.cost_credits ?? 0), 0) * 100) / 100, tone: "default" },
      { label: "Outbound share", value: `${pct(byDirection.get("outbound") ?? 0)}%`, tone: "default" },
    ],
    by_status: entries(byStatus),
    by_sentiment: entries(count(list.flatMap((c) => (c.sentiment ? [c.sentiment] : [])))),
    by_direction: entries(byDirection),
    recent_calls: list.slice(0, 8),
    filters: {
      statuses: uniq(list.map((c) => c.status)),
      voices: uniq(list.map((c) => c.voice_used)),
      directions: uniq(list.map((c) => c.direction)),
      sentiments: uniq(list.map((c) => c.sentiment)),
      topics: uniq(list.map((c) => c.topic)),
      tags: uniq(list.flatMap((c) => c.tags)),
    },
  });
}

export async function getDashboardTimeseries(filters: FilterParams): Promise<DashboardTimeseries> {
  const list = filterCalls(filters);
  const perDay = new Map<string, Record<string, number>>();
  const heat = new Map<string, number>();
  const sentimentTotals = new Map<string, { total: number; count: number }>();
  for (const c of list) {
    const t = new Date(c.started_at ?? c.created_at);
    const day = t.toISOString().slice(0, 10);
    const row = perDay.get(day) ?? {};
    row[c.status] = (row[c.status] ?? 0) + 1;
    perDay.set(day, row);
    const weekday = (t.getUTCDay() + 6) % 7;
    heat.set(`${weekday}-${t.getUTCHours()}`, (heat.get(`${weekday}-${t.getUTCHours()}`) ?? 0) + 1);
    if (c.topic && c.sentiment_score !== null) {
      const s = sentimentTotals.get(c.topic) ?? { total: 0, count: 0 };
      s.total += c.sentiment_score;
      s.count += 1;
      sentimentTotals.set(c.topic, s);
    }
  }
  const days = [...perDay.keys()].sort();
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return delay({
    generated_at: new Date().toISOString(),
    calls_over_time: days.map((day) => ({ day, count: Object.values(perDay.get(day)!).reduce((a, b) => a + b, 0) })),
    status_by_day: days.map((day) => ({ day, ...perDay.get(day)! })),
    top_topics: top(count(list.flatMap((c) => (c.topic ? [c.topic] : [])))),
    tag_breakdown: top(count(list.flatMap((c) => c.tags))),
    sentiment_by_topic: [...sentimentTotals]
      .map(([topic, s]) => ({ topic, average_score: Math.round((s.total / s.count) * 1000) / 1000, calls: s.count }))
      .sort((a, b) => b.average_score - a.average_score)
      .slice(0, 8),
    activity_heatmap: labels.flatMap((weekday_label, weekday) =>
      Array.from({ length: 24 }, (_, hour) => ({ weekday, weekday_label, hour, count: heat.get(`${weekday}-${hour}`) ?? 0 })),
    ),
    scatter: list
      .filter((c) => c.sentiment_score !== null && c.duration_seconds !== null)
      .map((c) => ({
        id: c.id,
        sentiment_score: c.sentiment_score!,
        duration_seconds: c.duration_seconds!,
        cost_credits: c.cost_credits ?? 0,
        topic: c.topic ?? "Unknown",
        status: c.status,
      })),
    outcome_breakdown: top(count(list.flatMap((c) => (c.outcome ? [c.outcome] : [])))),
  });
}

export async function getCalls(source?: string, limit = 50) {
  return delay(filterCalls({ source, limit, days: 90 }));
}

export async function previewPrompt(payload: CreateCallPayload): Promise<PromptPreview> {
  const sections: PromptPreview["sections"] = [
    { title: "Base system prompt", type: "base", content: payload.prompt.trim(), meta: { voice: payload.voice } },
  ];
  const citations: PromptPreview["citations"] = [];
  const snapshot_refs: PromptPreview["snapshot_refs"] = [];
  if (payload.inject_knowledge_base) {
    documents
      .filter((d) => d.status === "ready")
      .slice(0, payload.top_k)
      .forEach((d, i) => {
        const excerpt = `Sample excerpt ${i + 1} from ${d.filename}: fees and steps described in the demo knowledge base.`;
        sections.push({ title: `Knowledge base: ${d.filename}`, type: "knowledge", content: excerpt, meta: { score: 0.9 - i * 0.1 } });
        citations.push({ chunk_id: `${d.id}-c${i}`, document_id: d.id, document_name: d.filename, score: 0.9 - i * 0.1, excerpt });
      });
  }
  if (payload.inject_fx) {
    sections.push({ title: "FX market context", type: "integration", content: "USD/TRY 34.20, EUR/TRY 37.10 (demo values, not live rates).", meta: { provider: "fx_rates" } });
    snapshot_refs.push({ provider: "fx_rates", snapshot_id: "demo-fx" });
  }
  if (payload.inject_weather) {
    sections.push({ title: "Weather context", type: "integration", content: "Istanbul: 18°C, light clouds (demo values).", meta: { provider: "weather" } });
    snapshot_refs.push({ provider: "weather", snapshot_id: "demo-weather" });
  }
  sections.push({
    title: "Conversation guardrail",
    type: "guardrail",
    content: "Keep the call concise, professional, compliant, and specific. Use only the provided context, and do not fabricate account details.",
    meta: {},
  });
  const final_prompt = sections.filter((s) => s.content.trim()).map((s) => `${s.title}:\n${s.content}`).join("\n\n");
  return delay({ final_prompt, sections, citations, snapshot_refs });
}

export async function createCall(payload: CreateCallPayload): Promise<CreateCallResponse> {
  const call = makeCall(calls.length + 1000, new Date(), {
    source: "manual",
    status: "queued",
    phone_number: payload.phone_number,
    contact_name: "Demo call",
    direction: "outbound",
    voice_used: payload.voice,
    duration_seconds: null,
    duration_display: null,
    ended_at: null,
    sentiment: null,
    sentiment_score: null,
    outcome: null,
    transcript_preview: null,
    status_detail: "Demo mode: no real call is placed.",
    provider_status_available: true,
  });
  calls = [call, ...calls];
  return delay({ call, prompt_preview: await previewPrompt(payload), provider_response: { demo: true } });
}

export async function refreshCallStatus(callId: string) {
  const call = calls.find((c) => c.id === callId);
  if (!call) throw new Error("Call not found.");
  const next: Record<string, string> = { queued: "in_progress", in_progress: "completed" };
  call.status = next[call.status] ?? call.status;
  call.status_detail = `Demo status advanced to ${call.status}.`;
  call.status_last_checked_at = new Date().toISOString();
  if (call.status === "completed") {
    call.duration_seconds = 95;
    call.duration_display = "1m 35s";
    call.ended_at = new Date().toISOString();
  }
  return delay(call);
}

export async function getDocuments() {
  return delay(documents);
}

export async function deleteDocument(documentId: string) {
  documents = documents.filter((d) => d.id !== documentId);
  return delay(undefined);
}

export async function uploadDocument(file: File, onProgress?: (progress: number) => void): Promise<DocumentRecord> {
  for (const p of [20, 50, 80, 100]) {
    await delay(null, 150);
    onProgress?.(p);
  }
  const record = doc(`kb-${Date.now()}`, file.name, file.type || "text/plain", file.size, Math.max(1, Math.ceil(file.size / 800)), 0);
  record.status_message = "Indexed in the browser (demo only, nothing was uploaded).";
  documents = [record, ...documents];
  return delay(record);
}

export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  return delay({
    providers: [
      { provider: "fx_rates", healthy: true, cached_at: new Date(NOW).toISOString(), detail: "TRY benchmark exchange rates (demo)" },
      { provider: "weather", healthy: true, cached_at: new Date(NOW).toISOString(), detail: "Current weather for Istanbul (demo)" },
    ],
  });
}

export async function getCallConsoleSettings() {
  return delay(settings);
}

export async function updateCallConsoleSettings(payload: CallConsoleSettings) {
  settings = { ...payload, updated_at: new Date().toISOString() };
  return delay(settings);
}
