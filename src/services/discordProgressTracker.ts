import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ProgressService, ProgressUpdate } from './progressService';
import { Logger } from '../utils/logger';

export class DiscordProgressTracker {
  private static instance: DiscordProgressTracker;
  private progressService: ProgressService;
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.progressService = ProgressService.getInstance();
  }

  public static getInstance(): DiscordProgressTracker {
    if (!DiscordProgressTracker.instance) {
      DiscordProgressTracker.instance = new DiscordProgressTracker();
    }
    return DiscordProgressTracker.instance;
  }

  public async trackUploadProgress(
    interaction: ChatInputCommandInteraction,
    fileName: string,
    fileSize: number,
    uploadFunction: (onProgress: (progress: number) => void) => Promise<any>
  ): Promise<any> {
    const userId = interaction.user.id;
    const progressId = this.progressService.startProgress(
      userId,
      'upload',
      fileName,
      fileSize
    );

    // Create initial progress message
    const embed = this.createProgressEmbed('upload', fileName, fileSize, 0);
    const message = await interaction.editReply({ embeds: [embed] });

    // Register callback for progress updates
    this.progressService.registerCallback(progressId, (progress) => {
      this.updateProgressMessage(interaction, progress, message);
    });

    // Set up periodic updates
    const updateInterval = setInterval(() => {
      this.updateProgressMessage(interaction, this.progressService.getProgress(progressId)!, message);
    }, 2000); // Update every 2 seconds

    this.updateIntervals.set(progressId, updateInterval);

    try {
      const result = await uploadFunction((progress) => {
        this.progressService.updateProgress(progressId, progress);
      });

      this.progressService.completeProgress(progressId);
      this.clearUpdateInterval(progressId);

      // Send final success message
      const successEmbed = this.createSuccessEmbed('upload', fileName, fileSize);
      await interaction.editReply({ embeds: [successEmbed] });

      return result;
    } catch (error) {
      this.progressService.errorProgress(progressId, error as Error);
      this.clearUpdateInterval(progressId);

      // Send error message
      const errorEmbed = this.createErrorEmbed('upload', fileName, error as Error);
      await interaction.editReply({ embeds: [errorEmbed] });

      throw error;
    }
  }

  public async trackDownloadProgress(
    interaction: ChatInputCommandInteraction,
    fileName: string,
    fileSize: number,
    downloadFunction: (onProgress: (progress: number) => void) => Promise<any>
  ): Promise<any> {
    const userId = interaction.user.id;
    const progressId = this.progressService.startProgress(
      userId,
      'download',
      fileName,
      fileSize
    );

    // Create initial progress message
    const embed = this.createProgressEmbed('download', fileName, fileSize, 0);
    const message = await interaction.editReply({ embeds: [embed] });

    // Register callback for progress updates
    this.progressService.registerCallback(progressId, (progress) => {
      this.updateProgressMessage(interaction, progress, message);
    });

    // Set up periodic updates
    const updateInterval = setInterval(() => {
      this.updateProgressMessage(interaction, this.progressService.getProgress(progressId)!, message);
    }, 2000); // Update every 2 seconds

    this.updateIntervals.set(progressId, updateInterval);

    try {
      const result = await downloadFunction((progress) => {
        this.progressService.updateProgress(progressId, progress);
      });

      this.progressService.completeProgress(progressId);
      this.clearUpdateInterval(progressId);

      // Send final success message
      const successEmbed = this.createSuccessEmbed('download', fileName, fileSize);
      await interaction.editReply({ embeds: [successEmbed] });

      return result;
    } catch (error) {
      this.progressService.errorProgress(progressId, error as Error);
      this.clearUpdateInterval(progressId);

      // Send error message
      const errorEmbed = this.createErrorEmbed('download', fileName, error as Error);
      await interaction.editReply({ embeds: [errorEmbed] });

      throw error;
    }
  }

  private createProgressEmbed(
    operation: 'upload' | 'download',
    fileName: string,
    fileSize: number,
    progress: number
  ): EmbedBuilder {
    const operationEmoji = operation === 'upload' ? '📤' : '📥';
    const operationText = operation === 'upload' ? 'Uploading' : 'Downloading';
    const sizeText = fileSize > 1024 * 1024 
      ? `${Math.round(fileSize / 1024 / 1024)}MB`
      : `${Math.round(fileSize / 1024)}KB`;

    const progressBar = this.createProgressBar(progress);
    const elapsed = this.getElapsedTime(new Date());

    return new EmbedBuilder()
      .setTitle(`${operationEmoji} ${operationText} File`)
      .setColor(0x3498db)
      .addFields(
        { name: '📁 File', value: fileName, inline: true },
        { name: '📊 Size', value: sizeText, inline: true },
        { name: '⏱️ Elapsed', value: elapsed, inline: true },
        { name: 'Progress', value: `${progressBar} ${progress}%`, inline: false }
      )
      .setTimestamp();
  }

  private createSuccessEmbed(
    operation: 'upload' | 'download',
    fileName: string,
    fileSize: number
  ): EmbedBuilder {
    const operationEmoji = operation === 'upload' ? '✅' : '✅';
    const operationText = operation === 'upload' ? 'Uploaded' : 'Downloaded';
    const sizeText = fileSize > 1024 * 1024 
      ? `${Math.round(fileSize / 1024 / 1024)}MB`
      : `${Math.round(fileSize / 1024)}KB`;

    return new EmbedBuilder()
      .setTitle(`${operationEmoji} ${operationText} Successfully!`)
      .setColor(0x2ecc71)
      .addFields(
        { name: '📁 File', value: fileName, inline: true },
        { name: '📊 Size', value: sizeText, inline: true },
        { name: '⏱️ Status', value: 'Completed', inline: true }
      )
      .setTimestamp();
  }

  private createErrorEmbed(
    operation: 'upload' | 'download',
    fileName: string,
    error: Error
  ): EmbedBuilder {
    const operationEmoji = operation === 'upload' ? '❌' : '❌';
    const operationText = operation === 'upload' ? 'Upload Failed' : 'Download Failed';

    return new EmbedBuilder()
      .setTitle(`${operationEmoji} ${operationText}`)
      .setColor(0xe74c3c)
      .addFields(
        { name: '📁 File', value: fileName, inline: true },
        { name: '❌ Error', value: error.message, inline: false }
      )
      .setTimestamp();
  }

  private createProgressBar(progress: number, length: number = 20): string {
    const filled = Math.round((progress / 100) * length);
    const empty = length - filled;
    
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  private getElapsedTime(startTime: Date): string {
    const elapsed = Date.now() - startTime.getTime();
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private async updateProgressMessage(
    interaction: ChatInputCommandInteraction,
    progress: ProgressUpdate,
    _message: any
  ): Promise<void> {
    try {
      const embed = this.createProgressEmbed(
        progress.operation,
        progress.fileName,
        progress.totalSize || 0,
        progress.progress
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error('Failed to update progress message', error as Error, {
        progressId: progress.userId,
        operation: progress.operation
      });
    }
  }

  private clearUpdateInterval(progressId: string): void {
    const interval = this.updateIntervals.get(progressId);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(progressId);
    }
  }

  public cleanup(): void {
    // Clear all intervals
    for (const interval of this.updateIntervals.values()) {
      clearInterval(interval);
    }
    this.updateIntervals.clear();
  }
}
