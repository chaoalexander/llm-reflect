import { ModelConfig } from '../types';
import { BaseAdapter } from './base';
import { OpenAIAdapter } from './openai';

/**
 * 适配器工厂
 * 根据配置创建对应的 LLM 适配器
 */
export class AdapterFactory {
  /**
   * 创建生成模型适配器
   */
  static createGeneratorAdapter(config: ModelConfig): BaseAdapter {
    return new OpenAIAdapter(config);
  }

  /**
   * 创建判别模型适配器
   */
  static createCriticAdapter(config: ModelConfig): BaseAdapter {
    return new OpenAIAdapter(config);
  }
}

export { BaseAdapter } from './base';
export { OpenAIAdapter } from './openai';