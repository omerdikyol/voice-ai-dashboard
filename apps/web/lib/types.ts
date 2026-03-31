export type CallRecord = {
  id: string;
  external_call_id: string | null;
  source: string;
  contact_name: string | null;
  phone_number: string | null;
  direction: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  duration_seconds: number | null;
  duration_display: string | null;
  sentiment: string | null;
  sentiment_score: number | null;
  topic: string | null;
  outcome: string | null;
  agent_name: string | null;
  voice_used: string | null;
  transcript_preview: string | null;
  recording_url: string | null;
  tags: string[];
  cost_credits: number | null;
  provider_response?: Record<string, unknown> | null;
  status_detail: string | null;
  status_last_checked_at: string | null;
  provider_status_available: boolean;
};

export type DashboardSummary = {
  generated_at: string;
  synced_at: string | null;
  cards: { label: string; value: string | number; tone?: string }[];
  by_status: { key: string; count: number }[];
  by_sentiment: { key: string; count: number }[];
  by_direction: { key: string; count: number }[];
  recent_calls: CallRecord[];
  filters: {
    statuses: string[];
    voices: string[];
    directions: string[];
    sentiments: string[];
    topics: string[];
    tags: string[];
  };
};

export type DashboardTimeseries = {
  generated_at: string;
  calls_over_time: { day: string; count: number }[];
  status_by_day: Array<Record<string, number | string>>;
  top_topics: { key: string; count: number }[];
  tag_breakdown: { key: string; count: number }[];
  sentiment_by_topic: { topic: string; average_score: number; calls: number }[];
  scatter: {
    id: string;
    sentiment_score: number;
    duration_seconds: number;
    cost_credits: number;
    topic: string;
    status: string;
  }[];
  outcome_breakdown: { key: string; count: number }[];
};

export type PromptPreview = {
  final_prompt: string;
  sections: {
    title: string;
    type: string;
    content: string;
    meta: Record<string, unknown>;
  }[];
  citations: {
    chunk_id: string;
    document_id: string;
    document_name: string;
    score: number;
    excerpt: string;
  }[];
  snapshot_refs: { provider: string; snapshot_id: string }[];
};

export type CreateCallPayload = {
  voice: "burcin" | "callie";
  prompt: string;
  welcome_message: string;
  phone_number: string;
  inject_knowledge_base: boolean;
  inject_fx: boolean;
  inject_weather: boolean;
  top_k: number;
};

export type CallConsoleSettings = {
  voice: "burcin" | "callie";
  country_code: string;
  local_number: string;
  base_prompt: string;
  welcome_message: string;
  inject_knowledge_base: boolean;
  inject_fx: boolean;
  inject_weather: boolean;
  top_k: number;
  updated_at?: string | null;
};

export type CreateCallResponse = {
  call: CallRecord;
  prompt_preview: PromptPreview;
  provider_response: Record<string, unknown>;
};

export type DocumentRecord = {
  id: string;
  filename: string;
  mime_type: string;
  byte_size: number;
  status: string;
  chunk_count: number;
  error_message: string | null;
  uploaded_at: string;
  updated_at: string;
};

export type IntegrationStatus = {
  providers: {
    provider: string;
    healthy: boolean;
    cached_at: string | null;
    detail: string;
  }[];
};
