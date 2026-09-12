export type RealtimeStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

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

export interface RealtimeOptions {
  instructions: string;
  tools: RealtimeTool[];
  executeTool: (name: string, args: Record<string, unknown>) => unknown | Promise<unknown>;
  getContext: () => string;
}

export interface RealtimeStartOptions {
  mode?: "voice" | "text";
  initialText?: string;
}
