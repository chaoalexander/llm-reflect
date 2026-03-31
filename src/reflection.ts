import { ChatMessage, UsageStats, Logger, ModelConfig } from './types';
import { BaseAdapter, AdapterFactory } from './adapters';

/**
 * 难度级别
 */
type DifficultyLevel = 'simple' | 'medium' | 'hard';

/**
 * 难度评估结果
 */
interface DifficultyAssessment {
  difficulty: DifficultyLevel;
  difficultyReason: string;
  content?: string;
}

/**
 * 反思模式核心逻辑
 */
export class ReflectionService {
  private generatorAdapter: BaseAdapter;
  private criticAdapter: BaseAdapter;
  private logger: Logger;
  private reflectionRounds: number; // -1 表示 auto 模式
  private generatorModel: string;
  private criticModel: string;

  constructor(
    generatorConfig: ModelConfig,
    criticConfig: ModelConfig,
    reflectionRounds: number,
    logger: Logger
  ) {
    this.generatorAdapter = AdapterFactory.createGeneratorAdapter(generatorConfig);
    this.criticAdapter = AdapterFactory.createCriticAdapter(criticConfig);
    this.reflectionRounds = reflectionRounds;
    this.logger = logger;
    this.generatorModel = generatorConfig.model;
    this.criticModel = criticConfig.model;
  }

  /**
   * 执行反思流程
   * @param messages 用户消息列表
   * @returns 反思后的回答和用量统计
   */
  async reflect(messages: ChatMessage[]): Promise<{
    finalResponse: string;
    originalResponse: string;
    reflectionFeedback: string[];
    usage: UsageStats;
    metadata: {
      reflection_rounds: number;
      generator_model: string;
      critic_model: string;
      difficulty?: DifficultyLevel;
      difficultyReason?: string;
    };
  }> {
    // 总用量统计
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalReflectionTokens = 0;
    const reflectionFeedback: string[] = [];

    // 难度评估结果
    let difficulty: DifficultyLevel | undefined;
    let difficultyReason: string | undefined;
    let actualReflectionRounds = this.reflectionRounds;

    // 判断是否为 auto 模式
    const isAutoMode = this.reflectionRounds === -1;

    // 第一步：调用生成模型获取初始回答（带难度评估）
    this.logger.info('开始生成初始回答（带难度评估）...');
    
    const initialMessages = this.buildDifficultyAssessmentMessages(messages);
    const initialResult = await this.generatorAdapter.complete({
      model: this.generatorModel,
      messages: initialMessages,
      temperature: 0.7
    });

    // 解析难度评估结果
    const assessment = this.parseDifficultyAssessment(initialResult.content);
    difficulty = assessment.difficulty;
    difficultyReason = assessment.difficultyReason;

    // 如果是 auto 模式，根据难度确定反思轮数
    if (isAutoMode) {
      switch (difficulty) {
        case 'simple':
          actualReflectionRounds = 0;
          break;
        case 'medium':
          actualReflectionRounds = 1;
          break;
        case 'hard':
          actualReflectionRounds = 2;
          break;
        default:
          actualReflectionRounds = 0;
      }
      this.logger.info(`难度评估完成: ${difficulty}，将进行 ${actualReflectionRounds} 轮反思`);
    }

    // 提取实际内容（如果有难度评估字段）
    const originalResponse = assessment.content || initialResult.content;
    totalPromptTokens += initialResult.usage.prompt_tokens;
    totalCompletionTokens += initialResult.usage.completion_tokens;

    this.logger.info(`初始回答生成完成，长度: ${originalResponse.length}`);

    // 如果反思轮数为 0，直接返回原始回答
    if (actualReflectionRounds === 0) {
      return {
        finalResponse: originalResponse,
        originalResponse,
        reflectionFeedback: [],
        usage: {
          prompt_tokens: totalPromptTokens,
          completion_tokens: totalCompletionTokens,
          total_tokens: totalPromptTokens + totalCompletionTokens
        },
        metadata: {
          reflection_rounds: 0,
          generator_model: this.generatorModel,
          critic_model: this.criticModel,
          difficulty,
          difficultyReason
        }
      };
    }

    // 反思循环
    let currentResponse = originalResponse;
    let currentMessages = this.buildCriticMessages(messages, currentResponse);

    for (let round = 0; round < actualReflectionRounds; round++) {
      this.logger.info(`开始第 ${round + 1} 轮反思...`);

      // 第二步：调用判别模型获取评审意见
      const criticResult = await this.criticAdapter.complete({
        model: this.criticModel,
        messages: currentMessages,
        temperature: 0.3
      });

      const feedback = criticResult.content.trim();
      reflectionFeedback.push(feedback);
      totalReflectionTokens += criticResult.usage.completion_tokens;
      totalPromptTokens += criticResult.usage.prompt_tokens;

      this.logger.info(`第 ${round + 1} 轮评审意见: ${feedback.substring(0, 100)}...`);

      // 第三步：根据评审意见生成改进后的回答
      const improvedMessages = this.buildGeneratorMessages(messages, currentResponse, feedback);
      
      const improvedResult = await this.generatorAdapter.complete({
        model: this.generatorModel,
        messages: improvedMessages,
        temperature: 0.7
      });

      currentResponse = improvedResult.content;
      totalPromptTokens += improvedResult.usage.prompt_tokens;
      totalCompletionTokens += improvedResult.usage.completion_tokens;

      this.logger.info(`第 ${round + 1} 轮改进完成，新回答长度: ${currentResponse.length}`);

      // 更新判别模型的消息，用于下一轮反思
      currentMessages = this.buildCriticMessages(messages, currentResponse);
    }

    return {
      finalResponse: currentResponse,
      originalResponse,
      reflectionFeedback,
      usage: {
        prompt_tokens: totalPromptTokens,
        completion_tokens: totalCompletionTokens,
        total_tokens: totalPromptTokens + totalCompletionTokens,
        reflection_tokens: totalReflectionTokens,
        total_with_reflection: totalPromptTokens + totalCompletionTokens
      },
      metadata: {
        reflection_rounds: actualReflectionRounds,
        generator_model: this.generatorModel,
        critic_model: this.criticModel,
        difficulty,
        difficultyReason
      }
    };
  }

  /**
   * 构建带难度评估的生成模型消息
   */
  private buildDifficultyAssessmentMessages(messages: ChatMessage[]): ChatMessage[] {
    const userContent = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n');

    const difficultyPrompt = `你需要完成以下任务，并在回答时首先进行难度评估。

## 任务
${userContent}

## 输出要求
请先评估这个任务的难度，然后给出你的回答。难度评估标准如下：

| 难度 | 标准 | 反思轮次 |
|------|------|----------|
| **simple（简单）** | 目标明确，步骤清晰，工具选择无歧义，无需多源数据整合 | 0 轮（直接返回） |
| **medium（中等）** | 涉及多步骤协调、或需要在多个工具间做选择、或需要数据转换/格式处理 | 1 轮反思 |
| **hard（困难）** | 涉及复杂逻辑推理、多源数据交叉验证、创意性内容生成、或需要领域专业知识 | 2 轮反思 |

## 输出格式
请严格按照以下 JSON 格式输出难度评估部分，然后继续你的回答：
\`\`\`json
{
  "difficulty": "simple" | "medium" | "hard",
  "difficultyReason": "简要说明为什么是这个难度"
}
\`\`\`

注意：难度评估只需要给出 difficulty 和 difficultyReason 两个字段，不需要其他字段。`;

    return [
      { role: 'user', content: difficultyPrompt }
    ];
  }

  /**
   * 解析难度评估结果
   */
  private parseDifficultyAssessment(content: string): DifficultyAssessment {
    // 尝试提取 JSON 部分（带 ```json ``` 包裹）
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.difficulty && ['simple', 'medium', 'hard'].includes(parsed.difficulty)) {
          // 提取 JSON 之后的内容作为实际回答
          const actualContent = content.replace(jsonMatch[0], '').trim();
          // 如果实际内容为空或太短，返回默认
          if (!actualContent || actualContent.length < 2) {
            return {
              difficulty: parsed.difficulty,
              difficultyReason: parsed.difficultyReason || '',
              content: '你好！有什么我可以帮助你的吗？'
            };
          }
          return {
            difficulty: parsed.difficulty,
            difficultyReason: parsed.difficultyReason || '',
            content: actualContent
          };
        }
      } catch (e) {
        // JSON 解析失败，继续尝试其他方式
      }
    }

    // 如果没有找到 JSON，尝试直接解析（不带 ```json ```）
    const directMatch = content.match(/"difficulty"\s*:\s*"([^"]+)"/);
    const reasonMatch = content.match(/"difficultyReason"\s*:\s*"([^"]+)"/);
    
    if (directMatch) {
      const difficulty = directMatch[1] as DifficultyLevel;
      if (['simple', 'medium', 'hard'].includes(difficulty)) {
        // 提取实际内容：移除 JSON 部分
        let actualContent = content;
        
        // 移除 JSON 行
        actualContent = actualContent
          .replace(/"difficulty"\s*:\s*"[^"]+",?\s*/g, '')
          .replace(/"difficultyReason"\s*:\s*"[^"]+",?\s*/g, '')
          .replace(/^{[^}]*}/g, '')
          .replace(/^[{}\s]+/g, '')
          .trim();
        
        // 如果实际内容为空或太短，返回默认回复
        if (!actualContent || actualContent.length < 2) {
          return {
            difficulty,
            difficultyReason: reasonMatch ? reasonMatch[1] : '',
            content: '你好！有什么我可以帮助你的吗？'
          };
        }
        
        return {
          difficulty,
          difficultyReason: reasonMatch ? reasonMatch[1] : '',
          content: actualContent
        };
      }
    }

    // 无法解析难度，默认返回 simple
    return {
      difficulty: 'simple',
      difficultyReason: '无法评估难度，使用默认简单模式',
      content: '你好！有什么我可以帮助你的吗？'
    };
  }

  /**
   * 构建判别模型的消息
   * 包含原始输入、生成模型的回答、以及评审提示
   */
  private buildCriticMessages(messages: ChatMessage[], response: string): ChatMessage[] {
    const userContent = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n');

    const criticPrompt = `---- 生成模型输入 ----
${userContent}
---- 生成模型回答 ----
${response}
----
你是一个严格且苛刻的评论者。上面是另一个 AI 模型收到的输入和它给出的输出。请从以下角度逐一分析并给出具体的改进建议：    
 1. 完整性：是否遗漏了关键信息或步骤                          
 2. 准确性：是否存在事实错误或逻辑漏洞                        
 3. 可执行性：方案是否可以实际执行，有无遗漏的前置条件         
 4. 效率：是否有更简洁或更高效的方案                          
 5. 边界情况：是否考虑了异常和边界情况  

请给出具体的改进建议，直接指出问题所在并提供改进方案。`;

    return [
      { role: 'user', content: criticPrompt }
    ];
  }

  /**
   * 构建生成模型的消息
   * 包含原始输入、之前的回答、以及评审意见
   */
  private buildGeneratorMessages(messages: ChatMessage[], response: string, feedback: string): ChatMessage[] {
    const userContent = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n');

    const improvedPrompt = `---- 生成模型输入 ----
${userContent}
---- 生成模型回答 ----
${response}
---- 以下是另一位评审者给出的改进意见，请参考后给出新的回答。你不需要全盘接受所有建议，但需要认真考虑每一条并决定是否采纳 。回答请注意条理清晰，主次分明，结构合理 ----
${feedback}`;

    return [
      { role: 'user', content: improvedPrompt }
    ];
  }
}