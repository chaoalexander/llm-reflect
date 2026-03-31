import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Config } from './types';

/**
 * 加载 YAML 配置文件
 */
export function loadConfig(configPath?: string): Config {
  const defaultPath = path.join(process.cwd(), 'config.yaml');
  const filePath = configPath || defaultPath;

  if (!fs.existsSync(filePath)) {
    throw new Error(`配置文件不存在: ${filePath}`);
  }

  const fileContents = fs.readFileSync(filePath, 'utf8');
  const config = yaml.load(fileContents) as Config;

  // 验证配置
  validateConfig(config);

  return config;
}

/**
 * 验证配置项
 */
function validateConfig(config: Config): void {
  if (!config.generator?.base_url) {
    throw new Error('配置错误: generator.base_url 不能为空');
  }
  if (!config.generator?.model) {
    throw new Error('配置错误: generator.model 不能为空');
  }
  if (!config.critic?.base_url) {
    throw new Error('配置错误: critic.base_url 不能为空');
  }
  if (!config.critic?.model) {
    throw new Error('配置错误: critic.model 不能为空');
  }
  if (typeof config.reflection_rounds === 'number' && config.reflection_rounds < 0) {
    throw new Error('配置错误: reflection_rounds 不能为负数');
  }
  if (typeof config.reflection_rounds === 'string' && config.reflection_rounds !== 'auto') {
    throw new Error('配置错误: reflection_rounds 必须是数字或 "auto"');
  }
  if (typeof config.reflection_rounds === 'number' && config.reflection_rounds > 3) {
    throw new Error('配置错误: reflection_rounds 最大值为 3');
  }
  if (!['openai', 'raw'].includes(config.output_format)) {
    throw new Error('配置错误: output_format 必须是 openai 或 raw');
  }
  if (!config.server?.port) {
    throw new Error('配置错误: server.port 不能为空');
  }
}