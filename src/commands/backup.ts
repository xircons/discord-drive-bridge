import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { BackupService } from '../services/backupService';
import { GoogleDriveService } from '../services/googleDriveService';
import { OAuthService } from '../services/oauthService';
import { RateLimiter } from '../middleware/rateLimiter';
import { UserModel } from '../database/connection';
import { Logger } from '../utils/logger';

export const backupCommand = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Manage automated backups of Google Drive folders')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new backup schedule')
        .addStringOption(option =>
          option
            .setName('folder')
            .setDescription('Folder name to backup')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('schedule')
            .setDescription('Backup schedule (cron expression)')
            .setRequired(true)
            .addChoices(
              { name: 'Daily at 2 AM', value: '0 2 * * *' },
              { name: 'Weekly on Sunday at 3 AM', value: '0 3 * * 0' },
              { name: 'Monthly on 1st at 4 AM', value: '0 4 1 * *' },
              { name: 'Every 6 hours', value: '0 */6 * * *' },
              { name: 'Every 12 hours', value: '0 */12 * * *' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List your backup schedules')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('run')
        .setDescription('Run a backup manually')
        .addStringOption(option =>
          option
            .setName('schedule_id')
            .setDescription('Schedule ID to run')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a backup schedule')
        .addStringOption(option =>
          option
            .setName('schedule_id')
            .setDescription('Schedule ID to delete')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check backup status and recent jobs')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = BigInt(interaction.user.id);
    
    // Check rate limit
    const rateLimit = await RateLimiter.checkRateLimit(userId, 'backup');
    if (!rateLimit.allowed) {
      await interaction.reply({ 
        content: rateLimit.error || 'Rate limit exceeded', 
        ephemeral: true 
      });
      return;
    }

    try {
      // Check if user is authenticated
      const user = await UserModel.findById(userId);
      if (!user) {
        await interaction.reply({ 
          content: 'You are not connected to Google Drive. Use `/login` to connect your account.', 
          ephemeral: true 
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const backupService = BackupService.getInstance();

      switch (subcommand) {
        case 'create':
          await this.handleCreate(interaction, backupService, user);
          break;
        case 'list':
          await this.handleList(interaction, backupService);
          break;
        case 'run':
          await this.handleRun(interaction, backupService);
          break;
        case 'delete':
          await this.handleDelete(interaction, backupService);
          break;
        case 'status':
          await this.handleStatus(interaction, backupService);
          break;
        default:
          await interaction.reply({ 
            content: 'Unknown subcommand.', 
            ephemeral: true 
          });
      }

    } catch (error) {
      Logger.error('Backup command failed', error as Error, { userId: userId.toString() });
      await interaction.reply({ 
        content: 'An error occurred while processing your request. Please try again later.', 
        ephemeral: true 
      });
    }
  },

  async handleCreate(interaction: ChatInputCommandInteraction, backupService: BackupService, user: any) {
    const folderName = interaction.options.get('folder')?.value as string;
    const cronExpression = interaction.options.get('schedule')?.value as string;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Get OAuth client and drive service
      const oauth2Client = await new OAuthService().getOAuth2Client(user);
      const driveService = new GoogleDriveService(oauth2Client);

      // Find the folder
      const searchResults = await driveService.searchFiles({
        query: `name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
        pageSize: 1
      });

      if (searchResults.files.length === 0) {
        await interaction.editReply({
          content: `❌ **Folder not found:** "${folderName}"\n\nPlease make sure the folder exists in your Google Drive.`
        });
        return;
      }

      const folder = searchResults.files[0];
      
      // Create backup schedule
      const schedule = await backupService.createSchedule(
        user.id.toString(),
        folder.id,
        folder.name,
        cronExpression
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ Backup Schedule Created')
        .setColor(0x2ecc71)
        .addFields(
          { name: '📁 Folder', value: folder.name, inline: true },
          { name: '⏰ Schedule', value: this.formatCronExpression(cronExpression), inline: true },
          { name: '🆔 Schedule ID', value: schedule.id, inline: true },
          { name: '📅 Next Run', value: schedule.nextRun?.toLocaleString() || 'Unknown', inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      Logger.audit(user.id, 'backup_schedule_created', {
        scheduleId: schedule.id,
        folderName: folder.name,
        cronExpression,
        success: true
      });

    } catch (error) {
      Logger.error('Failed to create backup schedule', error as Error);
      await interaction.editReply({
        content: `❌ **Failed to create backup schedule:** ${(error as Error).message}`
      });
    }
  },

  async handleList(interaction: ChatInputCommandInteraction, backupService: BackupService) {
    const userId = interaction.user.id;
    const schedules = backupService.getUserSchedules(userId);

    if (schedules.length === 0) {
      await interaction.reply({
        content: '📋 **No backup schedules found.**\n\nUse `/backup create` to create your first backup schedule.',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Your Backup Schedules')
      .setColor(0x3498db)
      .setTimestamp();

    schedules.forEach((schedule, index) => {
      const status = schedule.enabled ? '✅ Enabled' : '❌ Disabled';
      const lastRun = schedule.lastRun ? schedule.lastRun.toLocaleString() : 'Never';
      const nextRun = schedule.nextRun ? schedule.nextRun.toLocaleString() : 'Unknown';

      embed.addFields({
        name: `${index + 1}. ${schedule.folderName}`,
        value: `**ID:** ${schedule.id}\n` +
               `**Schedule:** ${this.formatCronExpression(schedule.cronExpression)}\n` +
               `**Status:** ${status}\n` +
               `**Last Run:** ${lastRun}\n` +
               `**Next Run:** ${nextRun}`,
        inline: false
      });
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async handleRun(interaction: ChatInputCommandInteraction, backupService: BackupService) {
    const scheduleId = interaction.options.get('schedule_id')?.value as string;

    await interaction.deferReply({ ephemeral: true });

    try {
      const schedule = backupService.getSchedule(scheduleId);
      if (!schedule) {
        await interaction.editReply({
          content: `❌ **Schedule not found:** ${scheduleId}`
        });
        return;
      }

      if (schedule.userId !== interaction.user.id) {
        await interaction.editReply({
          content: '❌ **Access denied.** You can only run your own backup schedules.'
        });
        return;
      }

      // Execute backup
      const job = await backupService.executeBackup(scheduleId);

      const embed = new EmbedBuilder()
        .setTitle('🔄 Backup Executed')
        .setColor(job.status === 'completed' ? 0x2ecc71 : 0xe74c3c)
        .addFields(
          { name: '📁 Folder', value: schedule.folderName, inline: true },
          { name: '📊 Status', value: job.status.toUpperCase(), inline: true },
          { name: '📈 Files Backed Up', value: `${job.filesBackedUp}/${job.totalFiles}`, inline: true },
          { name: '⏱️ Duration', value: job.endTime ? `${Math.round((job.endTime.getTime() - job.startTime.getTime()) / 1000)}s` : 'N/A', inline: true }
        )
        .setTimestamp();

      if (job.errorMessage) {
        embed.addFields({ name: '❌ Error', value: job.errorMessage, inline: false });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      Logger.error('Failed to run backup', error as Error);
      await interaction.editReply({
        content: `❌ **Failed to run backup:** ${(error as Error).message}`
      });
    }
  },

  async handleDelete(interaction: ChatInputCommandInteraction, backupService: BackupService) {
    const scheduleId = interaction.options.get('schedule_id')?.value as string;

    await interaction.deferReply({ ephemeral: true });

    try {
      const schedule = backupService.getSchedule(scheduleId);
      if (!schedule) {
        await interaction.editReply({
          content: `❌ **Schedule not found:** ${scheduleId}`
        });
        return;
      }

      if (schedule.userId !== interaction.user.id) {
        await interaction.editReply({
          content: '❌ **Access denied.** You can only delete your own backup schedules.'
        });
        return;
      }

      await backupService.deleteSchedule(scheduleId);

      await interaction.editReply({
        content: `✅ **Backup schedule deleted successfully!**\n\n**Folder:** ${schedule.folderName}\n**Schedule ID:** ${scheduleId}`
      });

      Logger.audit(BigInt(schedule.userId), 'backup_schedule_deleted', {
        scheduleId,
        folderName: schedule.folderName,
        success: true
      });

    } catch (error) {
      Logger.error('Failed to delete backup schedule', error as Error);
      await interaction.editReply({
        content: `❌ **Failed to delete backup schedule:** ${(error as Error).message}`
      });
    }
  },

  async handleStatus(interaction: ChatInputCommandInteraction, backupService: BackupService) {
    const userId = interaction.user.id;
    const schedules = backupService.getUserSchedules(userId);
    const recentJobs = backupService.getUserBackupJobs(userId, 5);
    // const stats = backupService.getBackupStats();

    const embed = new EmbedBuilder()
      .setTitle('📊 Backup Status')
      .setColor(0x3498db)
      .addFields(
        { name: '📋 Total Schedules', value: schedules.length.toString(), inline: true },
        { name: '✅ Active Schedules', value: schedules.filter(s => s.enabled).length.toString(), inline: true },
        { name: '🔄 Recent Jobs', value: recentJobs.length.toString(), inline: true }
      )
      .setTimestamp();

    if (recentJobs.length > 0) {
      const jobsText = recentJobs.map(job => {
        const status = job.status === 'completed' ? '✅' : job.status === 'failed' ? '❌' : '🔄';
        const duration = job.endTime ? `${Math.round((job.endTime.getTime() - job.startTime.getTime()) / 1000)}s` : 'N/A';
        return `${status} ${job.startTime.toLocaleDateString()} - ${job.filesBackedUp}/${job.totalFiles} files (${duration})`;
      }).join('\n');

      embed.addFields({ name: '📈 Recent Backup Jobs', value: jobsText, inline: false });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },

  formatCronExpression(cronExpression: string): string {
    const expressions: Record<string, string> = {
      '0 2 * * *': 'Daily at 2:00 AM',
      '0 3 * * 0': 'Weekly on Sunday at 3:00 AM',
      '0 4 1 * *': 'Monthly on 1st at 4:00 AM',
      '0 */6 * * *': 'Every 6 hours',
      '0 */12 * * *': 'Every 12 hours'
    };

    return expressions[cronExpression] || cronExpression;
  }
};
