import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { GoogleDriveService } from '../services/googleDriveService';
import { OAuthService } from '../services/oauthService';
import { RateLimiter } from '../middleware/rateLimiter';
import { UserModel } from '../database/connection';
import { Logger } from '../utils/logger';
import { DiscordProgressTracker } from '../services/discordProgressTracker';

export const downloadCommand = {
  data: new SlashCommandBuilder()
    .setName('download')
    .setDescription('Download a file from Google Drive')
    .addStringOption(option =>
      option
        .setName('filename')
        .setDescription('Name of the file to download')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('folder')
        .setDescription('Folder name where the file is located (optional)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = BigInt(interaction.user.id);
    
    // Check rate limit
    const rateLimit = await RateLimiter.checkRateLimit(userId, 'download');
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

      const filename = interaction.options.get('filename')?.value as string;
      const folderName = interaction.options.get('folder')?.value as string;

      if (!filename) {
        await interaction.reply({ 
          content: 'No filename provided.', 
          ephemeral: true 
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      // Get OAuth client and drive service
      const oauth2Client = await new OAuthService().getOAuth2Client(user);
      const driveService = new GoogleDriveService(oauth2Client);

      // Build search query
      let query = `name='${filename}' and trashed=false`;
      if (folderName) {
        // First find the folder
        const folderSearch = await driveService.searchFiles({
          query: `name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
          maxResults: 1
        });

        if (folderSearch.files.length === 0) {
          await interaction.editReply({ 
            content: `❌ Folder '${folderName}' not found.` 
          });
          return;
        }

        query += ` and '${folderSearch.files[0].id}' in parents`;
      }

      // Search for the file
      const searchResults = await driveService.searchFiles({
        query,
        maxResults: 1
      });

      if (searchResults.files.length === 0) {
        await interaction.editReply({ 
          content: `❌ File '${filename}' not found${folderName ? ` in folder '${folderName}'` : ''}.` 
        });
        return;
      }

      const file = searchResults.files[0];

      // Determine if we should use chunked download (files > 10MB)
      const fileSize = 'size' in file && file.size ? parseInt(file.size) : 0;
      const useChunkedDownload = fileSize > 10 * 1024 * 1024; // 10MB threshold
      const progressTracker = DiscordProgressTracker.getInstance();
      
      let fileData;
      
      if (useChunkedDownload) {
        // Use progress tracker for large files
        fileData = await progressTracker.trackDownloadProgress(
          interaction,
          file.name,
          fileSize,
          async (onProgress) => {
            return await driveService.downloadFileChunked(file.id, onProgress);
          }
        );
      } else {
        // Regular download for smaller files
        fileData = await driveService.downloadFile(file.id);
      }

      // Send file to user via DM
      try {
        const sizeText = fileSize > 1024 * 1024 
          ? `${Math.round(fileSize / 1024 / 1024)}MB`
          : `${'size' in file && file.size ? Math.round(parseInt(file.size) / 1024) + 'KB' : 'Unknown'}`;

        await interaction.user.send({
          content: `📥 **File downloaded successfully!**\n\n` +
                  `📁 **File:** ${file.name}\n` +
                  `📊 **Size:** ${sizeText}\n` +
                  `📅 **Modified:** ${new Date(file.modifiedTime).toLocaleString()}`,
          files: [{
            attachment: fileData.data,
            name: file.name
          }]
        });

        await interaction.editReply({
          content: `✅ **File downloaded successfully!**\n\n` +
                  `📁 **File:** ${file.name}\n` +
                  `📤 **Sent to:** Your DMs\n` +
                  `📊 **Size:** ${sizeText}`
        });
      } catch (dmError) {
        Logger.error('Failed to send DM', dmError as Error, { userId: userId.toString() });
        await interaction.editReply({
          content: `❌ **Failed to send file to DMs.**\n\n` +
                  `Please check your DM settings and try again.`
        });
      }

      Logger.audit(userId, 'file_downloaded', {
        fileName: file.name,
        fileId: file.id,
        success: true
      });

    } catch (error) {
      Logger.error('Download command failed', error as Error, { userId: userId.toString() });
      await interaction.editReply({ 
        content: 'Failed to download file. Please try again later.' 
      });
    }
  }
};
