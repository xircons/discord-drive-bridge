import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { GoogleDriveService } from '../services/googleDriveService';
import { OAuthService } from '../services/oauthService';
import { RateLimiter } from '../middleware/rateLimiter';
import { ValidationService } from '../utils/validation';
import { UserModel } from '../database/connection';
import { Logger } from '../utils/logger';

export const createFolderCommand = {
  data: new SlashCommandBuilder()
    .setName('create-folder')
    .setDescription('Create a new folder in Google Drive')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Name of the folder to create')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('parent')
        .setDescription('Parent folder name (optional, defaults to root)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = BigInt(interaction.user.id);
    
    // Check rate limit
    const rateLimit = await RateLimiter.checkRateLimit(userId, 'create-folder');
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

      const folderName = interaction.options.get('name')?.value as string;
      const parentFolderName = interaction.options.get('parent')?.value as string;

      if (!folderName) {
        await interaction.reply({ 
          content: 'No folder name provided.', 
          ephemeral: true 
        });
        return;
      }

      // Validate folder name
      const validation = ValidationService.validateFolderName(folderName);
      if (!validation.valid) {
        await interaction.reply({ 
          content: validation.error, 
          ephemeral: true 
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      // Get OAuth client and drive service
      const oauth2Client = await new OAuthService().getOAuth2Client(user);
      const driveService = new GoogleDriveService(oauth2Client);

      // Find parent folder
      let parentFolderId = 'root';
      let parentDisplayName = 'Root';
      
      if (parentFolderName) {
        const parentValidation = ValidationService.validateFolderName(parentFolderName);
        if (!parentValidation.valid) {
          await interaction.editReply({ content: parentValidation.error });
          return;
        }

        const searchResults = await driveService.searchFiles({
          query: `name='${parentFolderName}' and mimeType='application/vnd.google-apps.folder'`,
          maxResults: 1
        });

        if (searchResults.files.length === 0) {
          await interaction.editReply({ 
            content: `❌ Parent folder '${parentFolderName}' not found.` 
          });
          return;
        }

        parentFolderId = searchResults.files[0].id;
        parentDisplayName = parentFolderName;
      }

      // Check if folder already exists
      const existingFolder = await driveService.searchFiles({
        query: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents`,
        maxResults: 1
      });

      if (existingFolder.files.length > 0) {
        await interaction.editReply({ 
          content: `❌ A folder named '${folderName}' already exists in '${parentDisplayName}'.` 
        });
        return;
      }

      // Create folder
      const newFolder = await driveService.createFolder(folderName, parentFolderId);

      await interaction.editReply({
        content: `✅ **Folder created successfully!**\n\n` +
                `📁 **Name:** ${newFolder.name}\n` +
                `📂 **Parent:** ${parentDisplayName}\n` +
                `🔗 **Link:** [Open in Google Drive](${newFolder.webViewLink || 'N/A'})`
      });

      Logger.audit(userId, 'folder_created', {
        folderName: newFolder.name,
        parentFolderId,
        folderId: newFolder.id,
        success: true
      });

    } catch (error) {
      Logger.error('Create folder command failed', error as Error, { userId: userId.toString() });
      await interaction.editReply({ 
        content: 'Failed to create folder. Please try again later.' 
      });
    }
  }
};
