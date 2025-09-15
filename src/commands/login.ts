import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { OAuthService } from '../services/oauthService';
import { RateLimiter } from '../middleware/rateLimiter';
import { Logger } from '../utils/logger';
import { CacheService } from '../services/cacheService';

export const loginCommand = {
  data: new SlashCommandBuilder()
    .setName('login')
    .setDescription('Connect your Google Drive account'),

  async execute(interaction: CommandInteraction) {
    const userId = BigInt(interaction.user.id);
    
    // Check rate limit
    const rateLimit = await RateLimiter.checkRateLimit(userId, 'login');
    if (!rateLimit.allowed) {
      await interaction.reply({ 
        content: rateLimit.error || 'Rate limit exceeded', 
        ephemeral: true 
      });
      return;
    }

    try {
      const oauthService = new OAuthService();
      const { url, codeVerifier } = oauthService.generateAuthUrl(userId);
      
      // Store code verifier in Redis with 15 minute expiration
      const cacheService = CacheService.getInstance();
      const codeVerifierKey = `oauth_code_verifier:${userId}`;
      await cacheService.set(codeVerifierKey, codeVerifier, 900); // 15 minutes
      
      Logger.info('Code verifier stored', { 
        userId: userId.toString(), 
        key: codeVerifierKey,
        expiresIn: 900 
      });
      
      await interaction.reply({
        content: `🔐 **Connect to Google Drive**\n\n` +
                `Click [here](${url}) to connect your Google Drive account.\n\n` +
                `⚠️ **Important:**\n` +
                `• This link will expire in 10 minutes\n` +
                `• Only use this link in a secure environment\n` +
                `• You'll be redirected back to Discord after authentication\n\n` +
                `After connecting, use \`/status\` to verify your connection.`,
        ephemeral: true
      });

      Logger.audit(userId, 'login_initiated', { success: true });
    } catch (error) {
      Logger.error('Login command failed', error as Error, { userId: userId.toString() });
      await interaction.reply({ 
        content: 'Failed to generate login URL. Please try again later.', 
        ephemeral: true 
      });
    }
  }
};
