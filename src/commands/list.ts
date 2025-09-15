import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { GoogleDriveService } from '../services/googleDriveService';
import { OAuthService } from '../services/oauthService';
import { RateLimiter } from '../middleware/rateLimiter';
import { UserModel } from '../database/connection';
import { Logger } from '../utils/logger';

export const listCommand = {
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription('List files and folders in Google Drive')
    .addStringOption(option =>
      option
        .setName('folder')
        .setDescription('Folder name to list (optional, defaults to root)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('page')
        .setDescription('Page number (default: 1)')
        .setRequired(false)
        .setMinValue(1)
    )
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Number of items per page (default: 20, max: 50)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(50)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = BigInt(interaction.user.id);
    
    // Check rate limit
    const rateLimit = await RateLimiter.checkRateLimit(userId, 'list');
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

      const folderName = interaction.options.get('folder')?.value as string;
      const page = (interaction.options.get('page')?.value as number) || 1;
      const limit = Math.min((interaction.options.get('limit')?.value as number) || 20, 50);

      await interaction.deferReply({ ephemeral: true });

      // Get OAuth client and drive service
      const oauth2Client = await new OAuthService().getOAuth2Client(user);
      const driveService = new GoogleDriveService(oauth2Client);

      // Find folder
      let folderId = 'root';
      let folderDisplayName = 'Root';
      
      if (folderName) {
        const searchResults = await driveService.searchFiles({
          query: `name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
          maxResults: 1
        });

        if (searchResults.files.length === 0) {
          await interaction.editReply({ 
            content: `❌ Folder '${folderName}' not found.` 
          });
          return;
        }

        folderId = searchResults.files[0].id;
        folderDisplayName = folderName;
      }

      // List files
      const result = await driveService.listFiles(
        folderId,
        limit,
        page > 1 ? `page_${page}` : undefined
      );

      if (result.files.length === 0) {
        await interaction.editReply({
          content: `📂 **${folderDisplayName}**\n\n` +
                  `This folder is empty.`
        });
        return;
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`📂 ${folderDisplayName}`)
        .setColor(0x4285F4)
        .setTimestamp();

      let description = '';
      result.files.forEach((file) => {
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        const icon = isFolder ? '📁' : '📄';
        const size = 'size' in file && file.size ? ` (${Math.round(parseInt(file.size) / 1024)}KB)` : '';
        const modified = new Date(file.modifiedTime).toLocaleDateString();
        
        description += `${icon} **${file.name}**${size}\n`;
        description += `   📅 Modified: ${modified}\n\n`;
      });

      embed.setDescription(description);

      // Add pagination info
      const totalPages = Math.ceil((result.totalCount || result.files.length) / limit);
      embed.setFooter({ 
        text: `Page ${page} of ${totalPages} • ${result.totalCount} items total` 
      });

      await interaction.editReply({ embeds: [embed] });

      Logger.audit(userId, 'files_listed', {
        folderId,
        page,
        limit,
        itemCount: result.files.length,
        success: true
      });

    } catch (error) {
      Logger.error('List command failed', error as Error, { userId: userId.toString() });
      await interaction.editReply({ 
        content: 'Failed to list files. Please try again later.' 
      });
    }
  }
};
