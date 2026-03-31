import { BaseAdapter } from './base';
import { ChatCompletionRequest, ChatCompletionResponse } from '../types';

/**
 * OpenAI 兼容格式适配器
 * 支持 OpenAI API 以及兼容 OpenAI 格式的 LLM 服务
 * 如：OpenAI、Azure OpenAI、Ollama、LM Studio 等
 */
export class OpenAIAdapter extends BaseAdapter {
  /**
   * 发送请求到 OpenAI 兼容 API
   */
  protected async makeRequest(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    // 如果请求中没有指定模型，使用配置中的默认模型
    const model = request.model || this.config.model;
    
    const requestBody = {
      ...request,
      model
    };

    // 移除 stream 参数，因为我们目前只支持同步调用
    delete requestBody.stream;

    const response = await this.client.post<ChatCompletionResponse>(
      '/chat/completions',
      requestBody,
      {
        headers: this.buildHeaders()
      }
    );

    return response.data;
  }
}