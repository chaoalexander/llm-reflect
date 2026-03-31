import { loadConfig } from './config';
import { createLogger } from './logger';
import { ReflectionService } from './reflection';
import { createServer } from './server';

/**
 * 主入口函数
 */
async function main(): Promise<void> {
  try {
    // 加载配置
    console.log('正在加载配置文件...');
    const config = loadConfig();
    console.log('配置文件加载成功');

    // 创建日志器
    const logger = createLogger(config.logging);
    logger.info('LLM 反思模型服务启动中...');

    // 创建反思服务
    // 如果配置为 "auto"，传入 -1 表示自动模式
    const reflectionRounds = config.reflection_rounds === 'auto' ? -1 : config.reflection_rounds;
    const reflectionService = new ReflectionService(
      config.generator,
      config.critic,
      reflectionRounds,
      logger
    );

    // 创建并启动 HTTP 服务器
    const app = createServer(config, reflectionService, logger);
    
    const { host, port } = config.server;
    app.listen(port, host, () => {
      logger.info(`服务已启动: http://${host}:${port}`);
      console.log(`\n🤖 LLM 反思模型服务已启动`);
      console.log(`📍 地址: http://${host}:${port}`);
      console.log(`📝 端点: POST /v1/chat/completions`);
      console.log(`🔄 反思轮数: ${config.reflection_rounds}`);
      console.log(`📊 输出格式: ${config.output_format}\n`);
    });
  } catch (error) {
    console.error('启动失败:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// 启动服务
main();