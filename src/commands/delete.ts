import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { GoogleDriveService } from '../services/googleDriveService';
import { OAuthService } from '../services/oauthService';
import { RateLimiter } from '../middleware/rateLimiter';
import { UserModel } from '../database/connection';
import { Logger } from '../utils/logger';

export const deleteCommand = {
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Delete a file or folder from Google Drive')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Name of the file or folder to delete')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('folder')
        .setDescription('Folder name where the item is located (optional)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Type of item to delete')
        .setRequired(false)
        .addChoices(
          { name: 'File', value: 'file' },
          { name: 'Folder', value: 'folder' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = BigInt(interaction.user.id);
    
    // Check rate limit
    const rateLimit = await RateLimiter.checkRateLimit(userId, 'delete');
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

      const itemName = interaction.options.get('name')?.value as string;
      const folderName = interaction.options.get('folder')?.value as string;
      const itemType = interaction.options.get('type')?.value as string;

      if (!itemName) {
        await interaction.reply({ 
          content: 'No item name provided.', 
          ephemeral: true 
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      // Get OAuth client and drive service
      const oauth2Client = await new OAuthService().getOAuth2Client(user);
      const driveService = new GoogleDriveService(oauth2Client);

      // Build search query
      let query = `name='${itemName}' and trashed=false`;
      if (itemType) {
        const mimeType = itemType === 'folder' 
          ? 'application/vnd.google-apps.folder' 
          : 'not application/vnd.google-apps.folder';
        query += ` and mimeType${itemType === 'folder' ? '=' : '!='}'${mimeType}'`;
      }

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

      // Search for the item
      const searchResults = await driveService.searchFiles({
        query,
        maxResults: 1
      });

      if (searchResults.files.length === 0) {
        await interaction.editReply({ 
          content: `❌ ${itemType === 'folder' ? 'Folder' : 'File'} '${itemName}' not found${folderName ? ` in folder '${folderName}'` : ''}.` 
        });
        return;
      }

      const item = searchResults.files[0];
      const isFolder = item.mimeType === 'application/vnd.google-apps.folder';

      // Create confirmation buttons
      const confirmButton = new ButtonBuilder()
        .setCustomId(`delete_confirm_${item.id}`)
        .setLabel('Yes, Delete')
        .setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId(`delete_cancel_${item.id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(confirmButton, cancelButton);

      await interaction.editReply({
        content: `⚠️ **Are you sure you want to delete this ${isFolder ? 'folder' : 'file'}?**\n\n` +
                `📁 **Name:** ${item.name}\n` +
                `📊 **Type:** ${isFolder ? 'Folder' : 'File'}\n` +
                `📅 **Modified:** ${new Date(item.modifiedTime).toLocaleString()}\n\n` +
                `**This action cannot be undone!**`,
        components: [row]
      });

      // Handle button interactions
      const filter = (i: any) => i.user.id === interaction.user.id && 
        (i.customId === `delete_confirm_${item.id}` || i.customId === `delete_cancel_${item.id}`);
      
      const collector = interaction.channel?.createMessageComponentCollector({ 
        filter, 
        time: 30000 
      });

      collector?.on('collect', async (i) => {
        if (i.customId === `delete_confirm_${item.id}`) {
          try {
            await i.deferUpdate();
            
            // Delete the item
            await driveService.deleteFile(item.id);
            
            await interaction.editReply({
              content: `✅ **${isFolder ? 'Folder' : 'File'} deleted successfully!**\n\n` +
                      `📁 **Name:** ${item.name}\n` +
                      `📊 **Type:** ${isFolder ? 'Folder' : 'File'}`,
              components: []
            });

            Logger.audit(userId, 'file_deleted', {
              fileName: item.name,
              fileId: item.id,
              isFolder,
              success: true
            });

          } catch (deleteError) {
            Logger.error('Delete operation failed', deleteError as Error, { 
              userId: userId.toString(),
              fileId: item.id 
            });
            
            await interaction.editReply({
              content: `❌ **Failed to delete ${isFolder ? 'folder' : 'file'}.**\n\n` +
                      `Please try again later.`,
              components: []
            });
          }
        } else if (i.customId === `delete_cancel_${item.id}`) {
          await i.deferUpdate();
          await interaction.editReply({
            content: `❌ **Deletion cancelled.**\n\n` +
                    `📁 **Name:** ${item.name}\n` +
                    `📊 **Type:** ${isFolder ? 'Folder' : 'File'}`,
            components: []
          });
        }
      });

      collector?.on('end', async () => {
        // Remove buttons after timeout
        try {
          await interaction.editReply({ components: [] });
        } catch (error) {
          // Ignore errors if message was already updated
        }
      });

    } catch (error) {
      Logger.error('Delete command failed', error as Error, { userId: userId.toString() });
      await interaction.editReply({ 
        content: 'Failed to process delete request. Please try again later.' 
      });
    }
  }
};
