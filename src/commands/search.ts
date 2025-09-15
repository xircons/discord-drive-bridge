import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { GoogleDriveService } from '../services/googleDriveService';
import { OAuthService } from '../services/oauthService';
import { RateLimiter } from '../middleware/rateLimiter';
import { UserModel } from '../database/connection';
import { Logger } from '../utils/logger';

export const searchCommand = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for files and folders in Google Drive')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('Search query (file name, content, etc.)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('folder')
        .setDescription('Search within specific folder (optional)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('mimetype')
        .setDescription('Filter by file type (optional)')
        .setRequired(false)
        .addChoices(
          { name: 'Documents', value: 'application/vnd.google-apps.document' },
          { name: 'Spreadsheets', value: 'application/vnd.google-apps.spreadsheet' },
          { name: 'Presentations', value: 'application/vnd.google-apps.presentation' },
          { name: 'Images', value: 'image/' },
          { name: 'Videos', value: 'video/' },
          { name: 'Audio', value: 'audio/' },
          { name: 'PDFs', value: 'application/pdf' },
          { name: 'Folders', value: 'application/vnd.google-apps.folder' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Maximum number of results (default: 10, max: 25)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = BigInt(interaction.user.id);
    
    // Check rate limit
    const rateLimit = await RateLimiter.checkRateLimit(userId, 'search');
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

      const query = interaction.options.get('query')?.value as string;
      const folderName = interaction.options.get('folder')?.value as string;
      const mimeType = interaction.options.get('mimetype')?.value as string;
      const limit = Math.min((interaction.options.get('limit')?.value as number) || 10, 25);

      if (!query) {
        await interaction.reply({ 
          content: 'No search query provided.', 
          ephemeral: true 
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      // Get OAuth client and drive service
      const oauth2Client = await new OAuthService().getOAuth2Client(user);
      const driveService = new GoogleDriveService(oauth2Client);

      // Build search query
      let searchQuery = `name contains '${query}' and trashed=false`;
      
      if (mimeType) {
        if (mimeType.endsWith('/')) {
          // Partial MIME type (e.g., 'image/', 'video/')
          searchQuery += ` and mimeType contains '${mimeType}'`;
        } else {
          // Exact MIME type
          searchQuery += ` and mimeType='${mimeType}'`;
        }
      }

      if (folderName) {
        // First find the folder
        const folderSearch = await driveService.searchFiles({
          query: `name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
          pageSize: 1
        });

        if (folderSearch.files.length === 0) {
          await interaction.editReply({ 
            content: `❌ Folder '${folderName}' not found.` 
          });
          return;
        }

        searchQuery += ` and '${folderSearch.files[0].id}' in parents`;
      }

      // Search for files
      const searchResults = await driveService.searchFiles({
        query: searchQuery,
        pageSize: limit
      });

      if (searchResults.files.length === 0) {
        await interaction.editReply({
          content: `🔍 **Search Results**\n\n` +
                  `**Query:** "${query}"\n` +
                  `**Folder:** ${folderName || 'All folders'}\n` +
                  `**Type:** ${mimeType || 'All types'}\n\n` +
                  `❌ No files found matching your search criteria.`
        });
        return;
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`🔍 Search Results`)
        .setColor(0x4285F4)
        .setTimestamp()
        .addFields(
          { name: 'Query', value: `"${query}"`, inline: true },
          { name: 'Folder', value: folderName || 'All folders', inline: true },
          { name: 'Type', value: mimeType || 'All types', inline: true }
        );

      let description = '';
      searchResults.files.forEach((file) => {
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        const icon = isFolder ? '📁' : '📄';
        const size = 'size' in file && file.size ? ` (${Math.round(parseInt(file.size) / 1024)}KB)` : '';
        const modified = new Date(file.modifiedTime).toLocaleDateString();
        
        description += `${icon} **${file.name}**${size}\n`;
        description += `   📅 Modified: ${modified}\n`;
        if (file.webViewLink) {
          description += `   🔗 [Open](${file.webViewLink})\n`;
        }
        description += '\n';
      });

      embed.setDescription(description);
      embed.setFooter({ 
        text: `Found ${searchResults.files.length} result${searchResults.files.length === 1 ? '' : 's'}` 
      });

      await interaction.editReply({ embeds: [embed] });

      Logger.audit(userId, 'files_searched', {
        query,
        folderName,
        mimeType,
        resultCount: searchResults.files.length,
        success: true
      });

    } catch (error) {
      Logger.error('Search command failed', error as Error, { userId: userId.toString() });
      await interaction.editReply({ 
        content: 'Failed to search files. Please try again later.' 
      });
    }
  }
};
