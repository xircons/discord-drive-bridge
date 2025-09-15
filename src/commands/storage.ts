import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { GoogleDriveService } from '../services/googleDriveService';
import { OAuthService } from '../services/oauthService';
import { RateLimiter } from '../middleware/rateLimiter';
import { UserModel } from '../database/connection';
import { Logger } from '../utils/logger';

export const storageCommand = {
  data: new SlashCommandBuilder()
    .setName('storage')
    .setDescription('Show Google Drive storage usage and statistics'),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = BigInt(interaction.user.id);
    
    // Check rate limit
    const rateLimit = await RateLimiter.checkRateLimit(userId, 'storage');
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

      await interaction.deferReply({ ephemeral: true });

      // Get OAuth client and drive service
      const oauth2Client = await new OAuthService().getOAuth2Client(user);
      const driveService = new GoogleDriveService(oauth2Client);

      // Get storage quota
      const quota = await driveService.getStorageQuota();
      
      // Get file statistics
      const fileStats = await driveService.getFileStatistics();

      // Calculate usage percentages
      const usageBytes = parseInt(quota.usage);
      const limitBytes = parseInt(quota.limit);
      const usagePercent = Math.round((usageBytes / limitBytes) * 100);
      
      // Convert to human readable format
      const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      const usedFormatted = formatBytes(usageBytes);
      const limitFormatted = formatBytes(limitBytes);
      const freeFormatted = formatBytes(limitBytes - usageBytes);

      // Create progress bar
      const progressBarLength = 20;
      const filledLength = Math.round((usagePercent / 100) * progressBarLength);
      const progressBar = '█'.repeat(filledLength) + '░'.repeat(progressBarLength - filledLength);

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle('💾 Google Drive Storage')
        .setColor(usagePercent > 90 ? 0xFF4444 : usagePercent > 75 ? 0xFFAA00 : 0x44AA44)
        .setThumbnail('https://drive.google.com/favicon.ico')
        .addFields(
          {
            name: '📊 Storage Usage',
            value: `**${usedFormatted}** / **${limitFormatted}**\n` +
                   `**${usagePercent}%** used\n` +
                   `\`${progressBar}\`\n` +
                   `**Free:** ${freeFormatted}`,
            inline: false
          },
          {
            name: '📁 File Statistics',
            value: `**Files:** ${fileStats.totalFiles.toLocaleString()}\n` +
                   `**Folders:** ${fileStats.totalFolders.toLocaleString()}\n` +
                   `**Google Docs:** ${fileStats.googleDocs.toLocaleString()}\n` +
                   `**Images:** ${fileStats.images.toLocaleString()}\n` +
                   `**Videos:** ${fileStats.videos.toLocaleString()}\n` +
                   `**Other:** ${fileStats.other.toLocaleString()}`,
            inline: true
          },
          {
            name: '📈 Recent Activity',
            value: `**Last 7 days:** ${fileStats.recentFiles} files\n` +
                   `**Last 30 days:** ${fileStats.monthlyFiles} files\n` +
                   `**Average file size:** ${formatBytes(fileStats.averageFileSize)}`,
            inline: true
          }
        )
        .setFooter({ 
          text: `Account: ${user.google_email} • Last updated: ${new Date().toLocaleString()}` 
        })
        .setTimestamp();

      // Add warning if storage is getting full
      if (usagePercent > 90) {
        embed.addFields({
          name: '⚠️ Storage Warning',
          value: 'Your Google Drive is almost full! Consider deleting unused files or upgrading your storage plan.',
          inline: false
        });
      } else if (usagePercent > 75) {
        embed.addFields({
          name: '💡 Storage Tip',
          value: 'Your Google Drive is getting full. Consider cleaning up old files or organizing your storage.',
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

      Logger.audit(userId, 'storage_viewed', {
        usagePercent,
        totalFiles: fileStats.totalFiles,
        success: true
      });

    } catch (error) {
      Logger.error('Storage command failed', error as Error, { userId: userId.toString() });
      await interaction.editReply({ 
        content: 'Failed to retrieve storage information. Please try again later.' 
      });
    }
  }
};
