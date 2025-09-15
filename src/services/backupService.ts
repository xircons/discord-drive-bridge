import * as cron from 'node-cron';
import { GoogleDriveService } from './googleDriveService';
import { OAuthService } from './oauthService';
import { UserModel } from '../database/connection';
import { Logger } from '../utils/logger';
import { CacheService } from './cacheService';

export interface BackupSchedule {
  id: string;
  userId: string;
  folderId: string;
  folderName: string;
  cronExpression: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BackupJob {
  id: string;
  scheduleId: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  filesBackedUp: number;
  totalFiles: number;
  errorMessage?: string;
}

export class BackupService {
  private static instance: BackupService;
  private schedules: Map<string, BackupSchedule> = new Map();
  private jobs: Map<string, BackupJob> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private cacheService: CacheService;

  private constructor() {
    this.cacheService = CacheService.getInstance();
    this.loadSchedules();
  }

  public static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  // Create a new backup schedule
  public async createSchedule(
    userId: string,
    folderId: string,
    folderName: string,
    cronExpression: string
  ): Promise<BackupSchedule> {
    const scheduleId = `backup_${userId}_${Date.now()}`;
    
    const schedule: BackupSchedule = {
      id: scheduleId,
      userId,
      folderId,
      folderName,
      cronExpression,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new Error('Invalid cron expression');
    }

    // Calculate next run time
    schedule.nextRun = this.calculateNextRun(cronExpression);

    this.schedules.set(scheduleId, schedule);
    await this.saveSchedule(schedule);
    await this.scheduleCronJob(schedule);

    Logger.info('Backup schedule created', {
      scheduleId,
      userId,
      folderName,
      cronExpression,
      nextRun: schedule.nextRun
    });

    return schedule;
  }

  // Update an existing backup schedule
  public async updateSchedule(
    scheduleId: string,
    updates: Partial<Pick<BackupSchedule, 'cronExpression' | 'enabled' | 'folderId' | 'folderName'>>
  ): Promise<BackupSchedule> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    // Update schedule
    Object.assign(schedule, updates);
    schedule.updatedAt = new Date();

    if (updates.cronExpression) {
      if (!cron.validate(updates.cronExpression)) {
        throw new Error('Invalid cron expression');
      }
      schedule.nextRun = this.calculateNextRun(updates.cronExpression);
    }

    // Cancel existing cron job
    const existingJob = this.cronJobs.get(scheduleId);
    if (existingJob) {
      existingJob.stop();
    }

    // Schedule new cron job if enabled
    if (schedule.enabled) {
      await this.scheduleCronJob(schedule);
    }

    await this.saveSchedule(schedule);
    this.schedules.set(scheduleId, schedule);

    Logger.info('Backup schedule updated', {
      scheduleId,
      updates,
      nextRun: schedule.nextRun
    });

    return schedule;
  }

  // Delete a backup schedule
  public async deleteSchedule(scheduleId: string): Promise<void> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    // Cancel cron job
    const cronJob = this.cronJobs.get(scheduleId);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(scheduleId);
    }

    // Remove from cache
    await this.cacheService.del(`backup_schedule:${scheduleId}`);
    this.schedules.delete(scheduleId);

    Logger.info('Backup schedule deleted', { scheduleId });
  }

  // Get all schedules for a user
  public getUserSchedules(userId: string): BackupSchedule[] {
    return Array.from(this.schedules.values())
      .filter(schedule => schedule.userId === userId);
  }

  // Get all schedules
  public getAllSchedules(): BackupSchedule[] {
    return Array.from(this.schedules.values());
  }

  // Get schedule by ID
  public getSchedule(scheduleId: string): BackupSchedule | undefined {
    return this.schedules.get(scheduleId);
  }

  // Get backup jobs for a user
  public getUserBackupJobs(userId: string, limit: number = 10): BackupJob[] {
    return Array.from(this.jobs.values())
      .filter(job => job.userId === userId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }

  // Execute a backup manually
  public async executeBackup(scheduleId: string): Promise<BackupJob> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const jobId = `job_${scheduleId}_${Date.now()}`;
    const job: BackupJob = {
      id: jobId,
      scheduleId,
      userId: schedule.userId,
      status: 'pending',
      startTime: new Date(),
      filesBackedUp: 0,
      totalFiles: 0
    };

    this.jobs.set(jobId, job);

    try {
      job.status = 'running';
      
      // Get user and OAuth client
      const user = await UserModel.findById(BigInt(schedule.userId));
      if (!user) {
        throw new Error('User not found');
      }

      const oauth2Client = await new OAuthService().getOAuth2Client(user);
      const driveService = new GoogleDriveService(oauth2Client);

      // Get all files in the folder
      const files = await driveService.listFiles(schedule.folderId, 1000);
      job.totalFiles = files.files.length;

      // Create backup folder with timestamp
      const backupFolderName = `Backup_${schedule.folderName}_${new Date().toISOString().split('T')[0]}`;
      const backupFolder = await driveService.createFolder(backupFolderName, 'root');

      // Copy files to backup folder
      for (const file of files.files) {
        try {
          if (file.mimeType !== 'application/vnd.google-apps.folder') {
            await driveService.copyFile(file.id, file.name, backupFolder.id);
            job.filesBackedUp++;
          }
        } catch (error) {
          Logger.error('Failed to backup file', error as Error, {
            fileId: file.id,
            fileName: file.name,
            jobId
          });
        }
      }

      job.status = 'completed';
      job.endTime = new Date();
      schedule.lastRun = new Date();
      schedule.nextRun = this.calculateNextRun(schedule.cronExpression);

      Logger.info('Backup completed', {
        jobId,
        scheduleId,
        filesBackedUp: job.filesBackedUp,
        totalFiles: job.totalFiles,
        duration: job.endTime.getTime() - job.startTime.getTime()
      });

    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      job.errorMessage = (error as Error).message;

      Logger.error('Backup failed', error as Error, {
        jobId,
        scheduleId,
        userId: schedule.userId
      });
    }

    this.jobs.set(jobId, job);
    return job;
  }

  // Private methods
  private async loadSchedules(): Promise<void> {
    try {
      // In a real implementation, you'd load from database
      // For now, we'll use Redis cache
      const scheduleKeys = await this.cacheService.get('backup_schedules:all');
      if (scheduleKeys) {
        const scheduleIds = JSON.parse(scheduleKeys);
        for (const scheduleId of scheduleIds) {
          const scheduleData = await this.cacheService.get(`backup_schedule:${scheduleId}`);
          if (scheduleData) {
            const schedule = JSON.parse(scheduleData);
            schedule.createdAt = new Date(schedule.createdAt);
            schedule.updatedAt = new Date(schedule.updatedAt);
            if (schedule.lastRun) {
              schedule.lastRun = new Date(schedule.lastRun);
            }
            if (schedule.nextRun) {
              schedule.nextRun = new Date(schedule.nextRun);
            }
            
            this.schedules.set(scheduleId, schedule);
            
            if (schedule.enabled) {
              await this.scheduleCronJob(schedule);
            }
          }
        }
      }
    } catch (error) {
      Logger.error('Failed to load backup schedules', error as Error);
    }
  }

  private async saveSchedule(schedule: BackupSchedule): Promise<void> {
    try {
      await this.cacheService.set(
        `backup_schedule:${schedule.id}`,
        JSON.stringify(schedule),
        86400 * 30 // 30 days
      );

      // Update schedule list
      const existingKeys = await this.cacheService.get('backup_schedules:all');
      const scheduleIds = existingKeys ? JSON.parse(existingKeys) : [];
      if (!scheduleIds.includes(schedule.id)) {
        scheduleIds.push(schedule.id);
        await this.cacheService.set(
          'backup_schedules:all',
          JSON.stringify(scheduleIds),
          86400 * 30
        );
      }
    } catch (error) {
      Logger.error('Failed to save backup schedule', error as Error, {
        scheduleId: schedule.id
      });
    }
  }

  private async scheduleCronJob(schedule: BackupSchedule): Promise<void> {
    const cronJob = cron.schedule(schedule.cronExpression, async () => {
      try {
        await this.executeBackup(schedule.id);
      } catch (error) {
        Logger.error('Scheduled backup failed', error as Error, {
          scheduleId: schedule.id,
          userId: schedule.userId
        });
      }
    }, {
      scheduled: false
    });

    this.cronJobs.set(schedule.id, cronJob);
    cronJob.start();

    Logger.info('Cron job scheduled', {
      scheduleId: schedule.id,
      cronExpression: schedule.cronExpression,
      nextRun: schedule.nextRun
    });
  }

  private calculateNextRun(cronExpression: string): Date {
    const task = cron.schedule(cronExpression, () => {}, { scheduled: false });
    const nextRun = new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to 24 hours from now
    task.stop();
    return nextRun;
  }

  // Cleanup old jobs
  public cleanupOldJobs(): void {
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.startTime < cutoffTime) {
        this.jobs.delete(jobId);
      }
    }
  }

  // Get backup statistics
  public getBackupStats(): {
    totalSchedules: number;
    activeSchedules: number;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
  } {
    const schedules = Array.from(this.schedules.values());
    const jobs = Array.from(this.jobs.values());

    return {
      totalSchedules: schedules.length,
      activeSchedules: schedules.filter(s => s.enabled).length,
      totalJobs: jobs.length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length
    };
  }

  // Stop all cron jobs (for graceful shutdown)
  public stopAllJobs(): void {
    for (const cronJob of this.cronJobs.values()) {
      cronJob.stop();
    }
    this.cronJobs.clear();
  }
}
