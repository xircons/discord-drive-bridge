import { SlashCommandBuilder, ChatInputCommandInteraction, Attachment } from 'discord.js';
import { GoogleDriveService } from '../services/googleDriveService';
import { OAuthService } from '../services/oauthService';
import { RateLimiter } from '../middleware/rateLimiter';
import { ValidationService } from '../utils/validation';
import { UserModel } from '../database/connection';
import { Logger } from '../utils/logger';

export const bulkUploadCommand = {
  data: new SlashCommandBuilder()
    .setName('bulk-upload')
    .setDescription('Upload multiple files to Google Drive')
    .addAttachmentOption(option =>
      option
        .setName('file1')
        .setDescription('First file to upload')
        .setRequired(true)
    )
    .addAttachmentOption(option =>
      option
        .setName('file2')
        .setDescription('Second file to upload')
        .setRequired(false)
    )
    .addAttachmentOption(option =>
      option
        .setName('file3')
        .setDescription('Third file to upload')
        .setRequired(false)
    )
    .addAttachmentOption(option =>
      option
        .setName('file4')
        .setDescription('Fourth file to upload')
        .setRequired(false)
    )
    .addAttachmentOption(option =>
      option
        .setName('file5')
        .setDescription('Fifth file to upload')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('folder')
        .setDescription('Folder name to upload to (optional)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = BigInt(interaction.user.id);
    
    // Check rate limit
    const rateLimit = await RateLimiter.checkRateLimit(userId, 'bulk-upload');
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

      // Collect all file attachments
      const attachments: Attachment[] = [];
      for (let i = 1; i <= 5; i++) {
        const attachment = interaction.options.get(`file${i}`)?.attachment as Attachment;
        if (attachment) {
          attachments.push(attachment);
        }
      }

      if (attachments.length === 0) {
        await interaction.reply({ 
          content: 'No file attachments provided.', 
          ephemeral: true 
        });
        return;
      }

      const folderName = interaction.options.get('folder')?.value as string;

      // Validate all files
      for (const attachment of attachments) {
        const fileValidation = ValidationService.validateFileName(attachment.name);
        if (!fileValidation.valid) {
          await interaction.reply({ 
            content: `Invalid filename: ${attachment.name} - ${fileValidation.error}`, 
            ephemeral: true 
          });
          return;
        }

        const sizeValidation = ValidationService.validateFileSize(attachment.size);
        if (!sizeValidation.valid) {
          await interaction.reply({ 
            content: `File too large: ${attachment.name} - ${sizeValidation.error}`, 
            ephemeral: true 
          });
          return;
        }
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

      // Upload files
      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];
        
        try {
          // Update progress
          await interaction.editReply({
            content: `📤 **Bulk Upload Progress**\n\n` +
                    `📁 **Folder:** ${folderName || 'Root'}\n` +
                    `📊 **Progress:** ${i + 1}/${attachments.length}\n` +
                    `✅ **Success:** ${successCount}\n` +
                    `❌ **Errors:** ${errorCount}\n\n` +
                    `🔄 **Uploading:** ${attachment.name}...`
          });

          // Download file data
          const fileResponse = await fetch(attachment.url);
          const fileData = Buffer.from(await fileResponse.arrayBuffer());

          // Upload file
          const uploadedFile = await driveService.uploadFile({
            fileName: attachment.name,
            mimeType: attachment.contentType || 'application/octet-stream',
            fileData,
            folderId
          });

          results.push({
            name: uploadedFile.name,
            success: true,
            size: attachment.size
          });
          successCount++;

        } catch (error) {
          Logger.error('Bulk upload file failed', error as Error, { 
            userId: userId.toString(),
            fileName: attachment.name 
          });
          
          results.push({
            name: attachment.name,
            success: false,
            error: 'Upload failed'
          });
          errorCount++;
        }
      }

      // Final results
      let resultMessage = `📤 **Bulk Upload Complete!**\n\n` +
                        `📁 **Folder:** ${folderName || 'Root'}\n` +
                        `📊 **Total Files:** ${attachments.length}\n` +
                        `✅ **Successful:** ${successCount}\n` +
                        `❌ **Failed:** ${errorCount}\n\n`;

      if (successCount > 0) {
        resultMessage += `**✅ Successfully Uploaded:**\n`;
        results.filter(r => r.success).forEach(r => {
          resultMessage += `• ${r.name} (${Math.round(r.size! / 1024)}KB)\n`;
        });
        resultMessage += '\n';
      }

      if (errorCount > 0) {
        resultMessage += `**❌ Failed to Upload:**\n`;
        results.filter(r => !r.success).forEach(r => {
          resultMessage += `• ${r.name}\n`;
        });
      }

      await interaction.editReply({ content: resultMessage });

      Logger.audit(userId, 'bulk_upload_completed', {
        folderId,
        totalFiles: attachments.length,
        successCount,
        errorCount,
        success: true
      });

    } catch (error) {
      Logger.error('Bulk upload command failed', error as Error, { userId: userId.toString() });
      await interaction.editReply({ 
        content: 'Failed to process bulk upload. Please try again later.' 
      });
    }
  }
};
