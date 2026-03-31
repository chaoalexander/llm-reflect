// 配置文件类型
export interface ModelConfig {
  base_url: string;
  api_key: string;
  model: string;
}

export interface LoggingConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  file: string;
}

export interface ServerConfig {
  host: string;
  port: number;
}

export type ReflectionRounds = number | 'auto';

export interface Config {
  generator: ModelConfig;
  critic: ModelConfig;
  reflection_rounds: ReflectionRounds;
  logging: LoggingConfig;
  output_format: 'openai' | 'raw';
  server: ServerConfig;
}

// OpenAI 兼容的消息格式
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  [key: string]: unknown;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// 用量统计信息
export interface UsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  reflection_tokens?: number;
  total_with_reflection?: number;
}

// 反思结果
export interface ReflectionResult {
  final_response: string;
  original_response: string;
  reflection_feedback: string[];
  usage: UsageStats;
  metadata: {
    reflection_rounds: number;
    generator_model: string;
    critic_model: string;
  };
}

// 日志类型
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

// 反思服务返回结果
export interface ReflectResult {
  finalResponse: string;
  originalResponse: string;
  reflectionFeedback: string[];
  usage: UsageStats;
}
