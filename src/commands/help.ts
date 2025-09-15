import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { RateLimiter } from '../middleware/rateLimiter';
import { Logger } from '../utils/logger';

export const helpCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands and usage information'),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = BigInt(interaction.user.id);
    
    // Check rate limit
    const rateLimit = await RateLimiter.checkRateLimit(userId, 'help');
    if (!rateLimit.allowed) {
      await interaction.reply({ 
        content: rateLimit.error || 'Rate limit exceeded', 
        ephemeral: true 
      });
      return;
    }

    try {
      const embed = new EmbedBuilder()
        .setTitle('🤖 Discord Drive Bridge - Help')
        .setDescription('A powerful Discord bot for managing your Google Drive files and folders.')
        .setColor(0x4285F4)
        .setThumbnail('https://drive.google.com/favicon.ico')
        .addFields(
          {
            name: '🔐 Authentication Commands',
            value: '`/login` - Connect your Google Drive account\n' +
                   '`/logout` - Disconnect your Google Drive account\n' +
                   '`/status` - Check connection status and storage info',
            inline: false
          },
          {
            name: '📁 File Management Commands',
            value: '`/upload` - Upload a file to Google Drive\n' +
                   '`/download` - Download a file to your DMs\n' +
                   '`/delete` - Delete a file or folder (with confirmation)\n' +
                   '`/list` - List files and folders in a directory',
            inline: false
          },
          {
            name: '🔧 Advanced Operations',
            value: '`/create-folder` - Create a new folder\n' +
                   '`/search` - Search for files and folders\n' +
                   '`/rename` - Rename a file or folder\n' +
                   '`/move` - Move a file or folder\n' +
                   '`/copy` - Copy a file or folder\n' +
                   '`/share` - Generate a shareable link',
            inline: false
          },
          {
            name: '📦 Bulk Operations',
            value: '`/bulk-upload` - Upload multiple files at once\n' +
                   '`/bulk-download` - Download entire folder as ZIP\n' +
                   '`/scheduled-backup` - Set up automatic backups',
            inline: false
          },
          {
            name: '🔍 Utility Commands',
            value: '`/storage` - Show storage usage and statistics\n' +
                   '`/recent` - Show recently modified files\n' +
                   '`/favorites` - Manage favorite files and folders\n' +
                   '`/help` - Show this help message',
            inline: false
          },
          {
            name: '📋 Usage Tips',
            value: '• All file operations support folder navigation\n' +
                   '• Use `/status` to check your connection and storage\n' +
                   '• File uploads are limited to 100MB per file\n' +
                   '• Rate limits apply to prevent abuse\n' +
                   '• Files are sent to your DMs for privacy',
            inline: false
          },
          {
            name: '🛡️ Security Features',
            value: '• OAuth 2.0 PKCE authentication\n' +
                   '• Encrypted token storage\n' +
                   '• Rate limiting per user and command\n' +
                   '• Input validation and sanitization\n' +
                   '• Audit logging of all actions',
            inline: false
          },
          {
            name: '🆘 Support',
            value: 'If you encounter issues:\n' +
                   '1. Check your connection with `/status`\n' +
                   '2. Try reconnecting with `/login`\n' +
                   '3. Check your DM settings for file downloads\n' +
                   '4. Ensure you have sufficient storage space',
            inline: false
          }
        )
        .setFooter({ 
          text: 'Discord Drive Bridge v1.0.0 • Made with ❤️ for Google Drive users' 
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

      Logger.audit(userId, 'help_requested', { success: true });

    } catch (error) {
      Logger.error('Help command failed', error as Error, { userId: userId.toString() });
      await interaction.reply({ 
        content: 'Failed to load help information. Please try again later.', 
        ephemeral: true 
      });
    }
  }
};
