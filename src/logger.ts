import * as fs from 'fs';
import * as path from 'path';
import { LogLevel, LoggingConfig, Logger } from './types';

export { Logger };
/**
 * 创建日志器
 */
export function createLogger(config: LoggingConfig): Logger {
  const logDir = path.dirname(config.file);
  
  // 确保日志目录存在
  if (config.enabled && logDir && !fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  const currentLevel = levels[config.level];

  function shouldLog(level: LogLevel): boolean {
    return config.enabled && levels[level] >= currentLevel;
  }

  function formatMessage(level: LogLevel, message: string, args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? ' ' + args.map(a => JSON.stringify(a)).join(' ') : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${argsStr}`;
  }

  function write(level: LogLevel, message: string, args: unknown[]): void {
    if (!shouldLog(level)) return;

    const formatted = formatMessage(level, message, args);
    
    // 输出到控制台
    console.log(formatted);

    // 写入文件
    if (config.enabled && config.file) {
      fs.appendFileSync(config.file, formatted + '\n');
    }
  }

  return {
    debug(message: string, ...args: unknown[]) {
      write('debug', message, args);
    },
    info(message: string, ...args: unknown[]) {
      write('info', message, args);
    },
    warn(message: string, ...args: unknown[]) {
      write('warn', message, args);
    },
    error(message: string, ...args: unknown[]) {
      write('error', message, args);
    }
  };
}