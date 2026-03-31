import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ModelConfig, ChatCompletionRequest, ChatCompletionResponse, UsageStats } from '../types';

/**
 * LLM 适配器基类
 */
export abstract class BaseAdapter {
  protected client: AxiosInstance;
  protected config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.base_url,
      timeout: 120000, // 2分钟超时
      headers: {
        'Content-Type': 'application/json',
        ...(config.api_key ? { 'Authorization': `Bearer ${config.api_key}` } : {})
      }
    });
  }

  /**
   * 调用 LLM 生成回答
   */
  async complete(request: ChatCompletionRequest): Promise<{
    content: string;
    usage: UsageStats;
  }> {
    const response = await this.makeRequest(request);
    return this.parseResponse(response);
  }

  /**
   * 发送请求到 LLM
   */
  protected abstract makeRequest(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;

  /**
   * 解析 LLM 响应
   */
  protected parseResponse(response: ChatCompletionResponse): {
    content: string;
    usage: UsageStats;
  } {
    const message = response.choices[0]?.message;
    const content = message?.content || '';
    const usage = response.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    };

    return { content, usage };
  }

  /**
   * 构建请求头
   */
  protected buildHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.api_key) {
      headers['Authorization'] = `Bearer ${this.config.api_key}`;
    }

    if (extraHeaders) {
      Object.assign(headers, extraHeaders);
    }

    return headers;
  }
}