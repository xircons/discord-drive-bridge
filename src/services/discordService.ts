import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from '../config';
import { Logger } from '../utils/logger';
import * as commands from '../commands';

export class DiscordService {
  private client: Client;
  private commands: Collection<string, any>;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
      ]
    });

    this.commands = new Collection();

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once('ready', () => {
      Logger.info('Discord bot is ready!', {
        botTag: this.client.user?.tag,
        guildCount: this.client.guilds.cache.size
      });
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isCommand()) return;

      try {
        const command = this.commands.get(interaction.commandName);
        if (!command) {
          await interaction.reply({ content: 'Command not found!', ephemeral: true });
          return;
        }

        await command.execute(interaction);
      } catch (error) {
        Logger.error('Error handling interaction', error as Error, {
          commandName: interaction.commandName,
          userId: interaction.user.id
        });

        const errorMessage = 'An error occurred while processing your command. Please try again later.';
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    });

    this.client.on('error', (error) => {
      Logger.error('Discord client error', error);
    });
  }

  async login(): Promise<void> {
    try {
      await this.client.login(config.discord.token);
    } catch (error) {
      Logger.error('Failed to login to Discord', error as Error);
      throw error;
    }
  }

  async registerCommands(): Promise<void> {
    try {
      const commandList = [
        commands.loginCommand,
        commands.logoutCommand,
        commands.statusCommand,
        commands.uploadCommand,
        commands.downloadCommand,
        commands.deleteCommand,
        commands.listCommand,
        commands.createFolderCommand,
        commands.searchCommand,
        commands.bulkUploadCommand,
        commands.storageCommand,
        commands.helpCommand
      ];

      // Register commands with Discord
      await this.client.application?.commands.set(commandList.map(cmd => cmd.data), config.discord.guildId);

      // Store command handlers
      commandList.forEach(command => {
        this.commands.set(command.data.name, command);
      });

      Logger.info('Discord commands registered successfully', { commandCount: commandList.length });
    } catch (error) {
      Logger.error('Failed to register Discord commands', error as Error);
      throw error;
    }
  }


  // Getter for client (needed for shutdown)
  getClient(): Client {
    return this.client;
  }
}