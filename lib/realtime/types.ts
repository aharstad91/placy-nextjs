export type RealtimeStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";
export type RealtimeMode = "voice" | "text";

export interface RealtimeMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
}

export interface RealtimeTool {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface RealtimeReferenceSource {
  id?: string;
  title?: string;
  url?: string;
}

export interface RealtimeReference {
  id: string;
  name: string;
  sources?: RealtimeReferenceSource[];
}

export interface RealtimeOptions {
  instructions: string;
  tools: RealtimeTool[];
  executeTool: (name: string, args: Record<string, unknown>) => unknown | Promise<unknown>;
  getContext: () => string;
  serverControlled?: boolean;
  snapshotId?: string;
}

export interface RealtimeStartOptions {
  mode?: RealtimeMode;
  initialText?: string;
}
