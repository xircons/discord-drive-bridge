import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { OAuthService } from '../services/oauthService';
import { GoogleDriveService } from '../services/googleDriveService';
import { RateLimiter } from '../middleware/rateLimiter';
import { UserModel } from '../database/connection';
import { Logger } from '../utils/logger';

export const statusCommand = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check your Google Drive connection status and storage usage'),

  async execute(interaction: CommandInteraction) {
    const userId = BigInt(interaction.user.id);
    
    // Check rate limit
    const rateLimit = await RateLimiter.checkRateLimit(userId, 'status');
    if (!rateLimit.allowed) {
      await interaction.reply({ 
        content: rateLimit.error || 'Rate limit exceeded', 
        ephemeral: true 
      });
      return;
    }

    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        await interaction.reply({
          content: `❌ **Not Connected to Google Drive**\n\n` +
                  `Use \`/login\` to connect your Google Drive account.`,
          ephemeral: true
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      // Check if token is still valid
      const oauthService = new OAuthService();
      const isValid = await oauthService.verifyToken(user);
      
      if (!isValid) {
        await interaction.editReply({
          content: `⚠️ **Connection Expired**\n\n` +
                  `Your Google Drive connection has expired.\n` +
                  `Use \`/login\` to reconnect your account.`,
        });
        return;
      }

      // Get storage info
      const oauth2Client = await oauthService.getOAuth2Client(user);
      const driveService = new GoogleDriveService(oauth2Client);
      const quota = await driveService.getStorageQuota();

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

      // Create progress bar
      const progressBarLength = 15;
      const filledLength = Math.round((usagePercent / 100) * progressBarLength);
      const progressBar = '█'.repeat(filledLength) + '░'.repeat(progressBarLength - filledLength);

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle('✅ Google Drive Connected')
        .setColor(0x44AA44)
        .setThumbnail('https://drive.google.com/favicon.ico')
        .addFields(
          {
            name: '👤 Account',
            value: `**Email:** ${user.google_email}\n` +
                   `**Connected:** ${user.created_at.toLocaleDateString()}\n` +
                   `**Last Updated:** ${user.updated_at.toLocaleDateString()}`,
            inline: true
          },
          {
            name: '💾 Storage',
            value: `**Used:** ${usedFormatted}\n` +
                   `**Total:** ${limitFormatted}\n` +
                   `**Usage:** ${usagePercent}%\n` +
                   `\`${progressBar}\``,
            inline: true
          },
          {
            name: '🔧 Status',
            value: `**Connection:** ✅ Active\n` +
                   `**Token:** ✅ Valid\n` +
                   `**Rate Limit:** ${rateLimit.remaining}/${rateLimit.max} remaining`,
            inline: true
          }
        )
        .setFooter({ 
          text: `User ID: ${userId.toString()} • Last checked: ${new Date().toLocaleString()}` 
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      Logger.audit(userId, 'status_checked', { 
        usagePercent,
        success: true 
      });

    } catch (error) {
      Logger.error('Status command failed', error as Error, { userId: userId.toString() });
      await interaction.editReply({ 
        content: 'Failed to check status. Please try again later.' 
      });
    }
  }
};
