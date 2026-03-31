import express, { Request, Response } from 'express';
import * as path from 'path';
import { Config, ChatCompletionRequest, ChatCompletionResponse, ReflectionResult } from './types';
import { ReflectionService } from './reflection';
import { Logger } from './logger';

/**
 * 创建 HTTP 服务器
 */
export function createServer(
  config: Config,
  reflectionService: ReflectionService,
  logger: Logger
): express.Application {
  const app = express();
  
  // 解析 JSON 请求体
  app.use(express.json());

  // 静态文件服务（用于聊天页面）
  app.use(express.static(path.join(__dirname, '../public')));

  // 健康检查接口
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      timestamp: Date.now(),
      reflection_rounds: config.reflection_rounds,
      output_format: config.output_format
    });
  });

  // OpenAI 兼容的 Chat Completions 接口
  app.post('/v1/chat/completions', async (req: Request, res: Response) => {
    try {
      const request = req.body as ChatCompletionRequest;
      
      logger.info('收到聊天完成请求', { model: request.model });

      // 提取消息
      const messages = request.messages;
      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: 'messages is required and must be an array' });
        return;
      }

      // 执行反思流程
      const result = await reflectionService.reflect(messages);

      // 根据配置格式化输出
      let responseContent: string;
      if (config.output_format === 'raw') {
        // 原始文本格式
        responseContent = result.finalResponse;
      } else {
        // OpenAI 格式
        responseContent = result.finalResponse;
      }

      // 构建响应
      const response: ChatCompletionResponse = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: config.generator.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: responseContent
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: result.usage.prompt_tokens,
          completion_tokens: result.usage.completion_tokens,
          total_tokens: result.usage.total_tokens
        }
      };

      // 添加反思相关信息到响应中（通过额外字段）
      (response as any)._reflection = {
        original_response: result.originalResponse,
        reflection_feedback: result.reflectionFeedback,
        reflection_rounds: result.metadata.reflection_rounds,
        reflection_tokens: result.usage.reflection_tokens,
        total_with_reflection: result.usage.total_with_reflection,
        difficulty: result.metadata.difficulty,
        difficultyReason: result.metadata.difficultyReason
      };

      logger.info('请求完成', {
        original_length: result.originalResponse.length,
        final_length: result.finalResponse.length,
        reflection_rounds: result.reflectionFeedback.length
      });

      res.json(response);
    } catch (error) {
      logger.error('处理请求时出错', error);
      res.status(500).json({
        error: {
          message: error instanceof Error ? error.message : 'Internal server error',
          type: 'internal_error'
        }
      });
    }
  });

  return app;
}