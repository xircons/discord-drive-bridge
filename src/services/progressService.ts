import { Logger } from '../utils/logger';

export interface ProgressUpdate {
  userId: string;
  operation: 'upload' | 'download';
  fileName: string;
  progress: number;
  status: 'starting' | 'in_progress' | 'completed' | 'error';
  startTime: Date;
  lastUpdate: Date;
  totalSize?: number;
  currentSize?: number;
}

export class ProgressService {
  private static instance: ProgressService;
  private progressMap: Map<string, ProgressUpdate> = new Map();
  private updateCallbacks: Map<string, (progress: ProgressUpdate) => void> = new Map();

  private constructor() {
    // Clean up old progress entries every 5 minutes
    setInterval(() => {
      this.cleanupOldEntries();
    }, 5 * 60 * 1000);
  }

  public static getInstance(): ProgressService {
    if (!ProgressService.instance) {
      ProgressService.instance = new ProgressService();
    }
    return ProgressService.instance;
  }

  public startProgress(
    userId: string,
    operation: 'upload' | 'download',
    fileName: string,
    totalSize?: number
  ): string {
    const progressId = `${userId}_${operation}_${Date.now()}`;
    
    const progress: ProgressUpdate = {
      userId,
      operation,
      fileName,
      progress: 0,
      status: 'starting',
      startTime: new Date(),
      lastUpdate: new Date(),
      totalSize,
      currentSize: 0
    };

    this.progressMap.set(progressId, progress);
    
    Logger.debug('Progress started', {
      progressId,
      userId,
      operation,
      fileName,
      totalSize
    });

    return progressId;
  }

  public updateProgress(
    progressId: string,
    progress: number,
    currentSize?: number,
    status?: 'in_progress' | 'completed' | 'error'
  ): void {
    const progressUpdate = this.progressMap.get(progressId);
    if (!progressUpdate) {
      Logger.warn('Progress update for unknown ID', { progressId });
      return;
    }

    progressUpdate.progress = Math.min(100, Math.max(0, progress));
    progressUpdate.lastUpdate = new Date();
    progressUpdate.status = status || 'in_progress';
    
    if (currentSize !== undefined) {
      progressUpdate.currentSize = currentSize;
    }

    this.progressMap.set(progressId, progressUpdate);

    // Notify callback if registered
    const callback = this.updateCallbacks.get(progressId);
    if (callback) {
      try {
        callback(progressUpdate);
      } catch (error) {
        Logger.error('Progress callback error', error as Error, { progressId });
      }
    }

    Logger.debug('Progress updated', {
      progressId,
      progress: progressUpdate.progress,
      status: progressUpdate.status,
      currentSize: progressUpdate.currentSize
    });
  }

  public completeProgress(progressId: string): void {
    this.updateProgress(progressId, 100, undefined, 'completed');
    
    // Remove from map after a delay to allow final callback
    setTimeout(() => {
      this.progressMap.delete(progressId);
      this.updateCallbacks.delete(progressId);
    }, 30000); // 30 seconds delay
  }

  public errorProgress(progressId: string, error: Error): void {
    this.updateProgress(progressId, 0, undefined, 'error');
    
    Logger.error('Progress error', error, { progressId });
    
    // Remove from map after a delay
    setTimeout(() => {
      this.progressMap.delete(progressId);
      this.updateCallbacks.delete(progressId);
    }, 60000); // 1 minute delay
  }

  public getProgress(progressId: string): ProgressUpdate | undefined {
    return this.progressMap.get(progressId);
  }

  public getUserProgress(userId: string): ProgressUpdate[] {
    return Array.from(this.progressMap.values())
      .filter(progress => progress.userId === userId);
  }

  public registerCallback(
    progressId: string,
    callback: (progress: ProgressUpdate) => void
  ): void {
    this.updateCallbacks.set(progressId, callback);
  }

  public unregisterCallback(progressId: string): void {
    this.updateCallbacks.delete(progressId);
  }

  private cleanupOldEntries(): void {
    const cutoffTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
    
    for (const [progressId, progress] of this.progressMap.entries()) {
      if (progress.lastUpdate < cutoffTime) {
        this.progressMap.delete(progressId);
        this.updateCallbacks.delete(progressId);
        
        Logger.debug('Cleaned up old progress entry', {
          progressId,
          lastUpdate: progress.lastUpdate
        });
      }
    }
  }

  public getProgressStats(): {
    totalActive: number;
    byOperation: Record<string, number>;
    byStatus: Record<string, number>;
  } {
    const active = Array.from(this.progressMap.values());
    
    const byOperation = active.reduce((acc, progress) => {
      acc[progress.operation] = (acc[progress.operation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byStatus = active.reduce((acc, progress) => {
      acc[progress.status] = (acc[progress.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalActive: active.length,
      byOperation,
      byStatus
    };
  }
}
