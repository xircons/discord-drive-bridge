import { SlashCommandBuilder, Attachment, ChatInputCommandInteraction } from 'discord.js';
import { GoogleDriveService } from '../services/googleDriveService';
import { OAuthService } from '../services/oauthService';
import { RateLimiter } from '../middleware/rateLimiter';
import { ValidationService } from '../utils/validation';
import { UserModel } from '../database/connection';
import { Logger } from '../utils/logger';
import { DiscordProgressTracker } from '../services/discordProgressTracker';

export const uploadCommand = {
  data: new SlashCommandBuilder()
    .setName('upload')
    .setDescription('Upload a file to Google Drive')
    .addAttachmentOption(option =>
      option
        .setName('file')
        .setDescription('The file to upload')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('folder')
        .setDescription('Folder name to upload to (optional)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Description for the file (optional)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = BigInt(interaction.user.id);
    
    // Check rate limit
    const rateLimit = await RateLimiter.checkRateLimit(userId, 'upload');
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

      const attachment = interaction.options.get('file')?.attachment as Attachment;
      const folderName = interaction.options.get('folder')?.value as string;
      const description = interaction.options.get('description')?.value as string;

      if (!attachment) {
        await interaction.reply({ 
          content: 'No file attachment provided.', 
          ephemeral: true 
        });
        return;
      }

      // Validate file
      const fileValidation = ValidationService.validateFileName(attachment.name);
      if (!fileValidation.valid) {
        await interaction.reply({ 
          content: fileValidation.error, 
          ephemeral: true 
        });
        return;
      }

      const sizeValidation = ValidationService.validateFileSize(attachment.size);
      if (!sizeValidation.valid) {
        await interaction.reply({ 
          content: sizeValidation.error, 
          ephemeral: true 
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      // Get OAuth client and drive service
      const oauth2Client = await new OAuthService().getOAuth2Client(user);
      const driveService = new GoogleDriveService(oauth2Client);

      // Find or create folder
      let folderId = 'root';
      if (folderName) {
        const folderValidation = ValidationService.validateFolderName(folderName);
        if (!folderValidation.valid) {
          await interaction.editReply({ content: folderValidation.error });
          return;
        }

        const searchResults = await driveService.searchFiles({
          query: `name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
          maxResults: 1
        });

        if (searchResults.files.length > 0) {
          folderId = searchResults.files[0].id;
        } else {
          // Create folder if it doesn't exist
          const newFolder = await driveService.createFolder(folderName, 'root');
          folderId = newFolder.id;
        }
      }

      // Download file data
      const fileResponse = await fetch(attachment.url);
      const fileData = Buffer.from(await fileResponse.arrayBuffer());

      // Determine if we should use chunked upload (files > 5MB)
      const useChunkedUpload = attachment.size > 5 * 1024 * 1024; // 5MB threshold
      const progressTracker = DiscordProgressTracker.getInstance();
      
      let uploadedFile;
      
      if (useChunkedUpload) {
        // Use progress tracker for large files
        uploadedFile = await progressTracker.trackUploadProgress(
          interaction,
          attachment.name,
          attachment.size,
          async (onProgress) => {
            return await driveService.uploadFileChunked({
              fileName: attachment.name,
              mimeType: attachment.contentType || 'application/octet-stream',
              fileData,
              folderId,
              description
            }, onProgress);
          }
        );
      } else {
        // Regular upload for smaller files
        uploadedFile = await driveService.uploadFile({
          fileName: attachment.name,
          mimeType: attachment.contentType || 'application/octet-stream',
          fileData,
          folderId,
          description
        });

        await interaction.editReply({
          content: `✅ **File uploaded successfully!**\n\n` +
                  `📁 **File:** ${uploadedFile.name}\n` +
                  `📂 **Folder:** ${folderName || 'Root'}\n` +
                  `📊 **Size:** ${Math.round(attachment.size / 1024)}KB\n` +
                  `🔗 **Link:** [Open in Google Drive](${uploadedFile.webViewLink || 'N/A'})`
        });
      }

      Logger.audit(userId, 'file_uploaded', {
        fileName: uploadedFile.name,
        folderId,
        fileSize: attachment.size,
        success: true
      });

    } catch (error) {
      Logger.error('Upload command failed', error as Error, { userId: userId.toString() });
      await interaction.editReply({ 
        content: 'Failed to upload file. Please try again later.' 
      });
    }
  }
};
