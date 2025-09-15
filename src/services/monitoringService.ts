import { Logger } from '../utils/logger';

export class MonitoringService {
  private static instance: MonitoringService;
  private metrics: Map<string, number> = new Map();
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  private constructor() {}

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  // Counter metrics
  incrementCounter(name: string, labels?: Record<string, string>): void {
    const key = this.formatKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + 1);
  }

  getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.formatKey(name, labels);
    return this.counters.get(key) || 0;
  }

  // Gauge metrics
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.formatKey(name, labels);
    this.metrics.set(key, value);
  }

  getGauge(name: string, labels?: Record<string, string>): number {
    const key = this.formatKey(name, labels);
    return this.metrics.get(key) || 0;
  }

  // Histogram metrics
  observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.formatKey(name, labels);
    const current = this.histograms.get(key) || [];
    current.push(value);
    this.histograms.set(key, current);
  }

  getHistogram(name: string, labels?: Record<string, string>): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
  } {
    const key = this.formatKey(name, labels);
    const values = this.histograms.get(key) || [];
    
    if (values.length === 0) {
      return { count: 0, sum: 0, avg: 0, min: 0, max: 0 };
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { count: values.length, sum, avg, min, max };
  }

  // Command metrics
  recordCommandExecution(command: string, duration: number, success: boolean): void {
    this.incrementCounter('discord_commands_total', { command, status: success ? 'success' : 'error' });
    this.observeHistogram('discord_command_duration_seconds', duration / 1000, { command });
  }

  recordFileOperation(operation: string, fileType: string, success: boolean): void {
    this.incrementCounter('file_operations_total', { operation, file_type: fileType, status: success ? 'success' : 'error' });
  }

  recordOAuthOperation(operation: string, success: boolean): void {
    this.incrementCounter('oauth_operations_total', { operation, status: success ? 'success' : 'error' });
  }

  recordRateLimit(userId: bigint, command: string): void {
    this.incrementCounter('rate_limits_total', { user_id: userId.toString(), command });
  }

  recordError(error: Error, context: string): void {
    this.incrementCounter('errors_total', { context, type: error.constructor.name });
    Logger.error('Error recorded in metrics', error, { context });
  }

  // System metrics
  recordMemoryUsage(): void {
    const usage = process.memoryUsage();
    this.setGauge('nodejs_memory_usage_bytes', usage.heapUsed, { type: 'heap_used' });
    this.setGauge('nodejs_memory_usage_bytes', usage.heapTotal, { type: 'heap_total' });
    this.setGauge('nodejs_memory_usage_bytes', usage.rss, { type: 'rss' });
    this.setGauge('nodejs_memory_usage_bytes', usage.external, { type: 'external' });
  }

  recordUptime(): void {
    this.setGauge('nodejs_uptime_seconds', process.uptime());
  }

  // Prometheus format export
  exportPrometheus(): string {
    let output = '';

    // Counters
    for (const [key, value] of this.counters) {
      const [name, labels] = this.parseKey(key);
      const labelString = labels ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}` : '';
      output += `# TYPE ${name} counter\n`;
      output += `${name}${labelString} ${value}\n`;
    }

    // Gauges
    for (const [key, value] of this.metrics) {
      const [name, labels] = this.parseKey(key);
      const labelString = labels ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}` : '';
      output += `# TYPE ${name} gauge\n`;
      output += `${name}${labelString} ${value}\n`;
    }

    // Histograms
    for (const [key, values] of this.histograms) {
      const [name, labels] = this.parseKey(key);
      const labelString = labels ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}` : '';
      
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.length;
      
      output += `# TYPE ${name} histogram\n`;
      output += `${name}_count${labelString} ${count}\n`;
      output += `${name}_sum${labelString} ${sum}\n`;
      
      if (count > 0) {
        const avg = sum / count;
        output += `${name}_avg${labelString} ${avg}\n`;
      }
    }

    return output;
  }

  // Health check
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: {
      totalCommands: number;
      errorRate: number;
      memoryUsage: number;
      uptime: number;
    };
  } {
    const totalCommands = Array.from(this.counters.entries())
      .filter(([key]) => key.startsWith('discord_commands_total'))
      .reduce((sum, [, value]) => sum + value, 0);

    const errorCommands = Array.from(this.counters.entries())
      .filter(([key]) => key.includes('status=error'))
      .reduce((sum, [, value]) => sum + value, 0);

    const errorRate = totalCommands > 0 ? (errorCommands / totalCommands) * 100 : 0;
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    const uptime = process.uptime();

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (errorRate > 10 || memoryUsage > 500) {
      status = 'degraded';
    }
    
    if (errorRate > 25 || memoryUsage > 1000) {
      status = 'unhealthy';
    }

    return {
      status,
      metrics: {
        totalCommands,
        errorRate: Math.round(errorRate * 100) / 100,
        memoryUsage: Math.round(memoryUsage * 100) / 100,
        uptime: Math.round(uptime)
      }
    };
  }

  private formatKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    
    const labelString = Object.entries(labels)
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    
    return `${name}{${labelString}}`;
  }

  private parseKey(key: string): [string, Record<string, string> | undefined] {
    const match = key.match(/^([^{]+)(?:\{(.+)\})?$/);
    if (!match) {
      return [key, undefined];
    }

    const name = match[1];
    const labelsString = match[2];
    
    if (!labelsString) {
      return [name, undefined];
    }

    const labels: Record<string, string> = {};
    const labelPairs = labelsString.split(',');
    
    for (const pair of labelPairs) {
      const [k, v] = pair.split('=');
      if (k && v) {
        labels[k] = v;
      }
    }

    return [name, labels];
  }
}
