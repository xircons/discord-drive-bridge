import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { OAuthService } from '../services/oauthService';
import { RateLimiter } from '../middleware/rateLimiter';
import { UserModel } from '../database/connection';
import { Logger } from '../utils/logger';

export const logoutCommand = {
  data: new SlashCommandBuilder()
    .setName('logout')
    .setDescription('Disconnect your Google Drive account'),

  async execute(interaction: CommandInteraction) {
    const userId = BigInt(interaction.user.id);
    
    // Check rate limit
    const rateLimit = await RateLimiter.checkRateLimit(userId, 'logout');
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
          content: 'You are not connected to Google Drive.', 
          ephemeral: true 
        });
        return;
      }

      const oauthService = new OAuthService();
      await oauthService.revokeTokens(user);
      
      await interaction.reply({
        content: `✅ **Successfully disconnected from Google Drive**\n\n` +
                `Your tokens have been revoked and all data has been cleared.\n\n` +
                `To reconnect, use \`/login\` again.`,
        ephemeral: true
      });

      Logger.audit(userId, 'logout_completed', { success: true });
    } catch (error) {
      Logger.error('Logout command failed', error as Error, { userId: userId.toString() });
      await interaction.reply({ 
        content: 'Failed to disconnect from Google Drive. Please try again later.', 
        ephemeral: true 
      });
    }
  }
};
