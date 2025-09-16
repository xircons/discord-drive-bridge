import { DiscordService } from '../../src/services/discordService';
import { Logger } from '../../src/utils/logger';

// Mock Discord.js
jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    user: { tag: 'test-bot#1234' },
    guilds: { cache: { size: 1 } },
    on: jest.fn(),
    once: jest.fn(),
    login: jest.fn(),
    destroy: jest.fn(),
    isReady: jest.fn(() => true)
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    DirectMessages: 3
  },
  Collection: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    get: jest.fn(),
    has: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    size: 0
  }))
}));

// Mock Logger
jest.mock('../../src/utils/logger', () => ({
  Logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock commands
jest.mock('../../src/commands', () => ({
  login: { data: { name: 'login' }, execute: jest.fn() },
  logout: { data: { name: 'logout' }, execute: jest.fn() },
  upload: { data: { name: 'upload' }, execute: jest.fn() },
  download: { data: { name: 'download' }, execute: jest.fn() },
  list: { data: { name: 'list' }, execute: jest.fn() },
  status: { data: { name: 'status' }, execute: jest.fn() },
  help: { data: { name: 'help' }, execute: jest.fn() }
}));

describe('DiscordService', () => {
  let discordService: DiscordService;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock client
    mockClient = {
      user: { tag: 'test-bot#1234' },
      guilds: { cache: { size: 1 } },
      on: jest.fn(),
      once: jest.fn(),
      login: jest.fn(),
      destroy: jest.fn(),
      isReady: jest.fn(() => true)
    };
    
    // Mock Client constructor
    const { Client } = require('discord.js');
    Client.mockImplementation(() => mockClient);
    
    discordService = new DiscordService();
  });

  describe('constructor', () => {
    it('should initialize Discord client with correct intents', () => {
      const { Client, GatewayIntentBits } = require('discord.js');
      
      expect(Client).toHaveBeenCalledWith({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.DirectMessages
        ]
      });
    });

    it('should setup event handlers', () => {
      expect(mockClient.once).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('interactionCreate', expect.any(Function));
    });
  });

  describe('login', () => {
    it('should login with bot token', async () => {
      await discordService.login();
      
      expect(mockClient.login).toHaveBeenCalled();
    });

    it('should handle login errors', async () => {
      const error = new Error('Invalid token');
      mockClient.login.mockRejectedValue(error);
      
      await expect(discordService.login()).rejects.toThrow('Invalid token');
    });
  });

  describe('getClient', () => {
    it('should return the Discord client', () => {
      const client = discordService.getClient();
      
      expect(client).toBe(mockClient);
    });
  });

  describe('event handlers', () => {
    describe('ready event', () => {
      it('should log bot ready message', () => {
        const readyHandler = mockClient.once.mock.calls.find((call: any) => call[0] === 'ready')[1];
        
        readyHandler();
        
        expect(Logger.info).toHaveBeenCalledWith('Discord bot is ready!', {
          botTag: 'test-bot#1234',
          guildCount: 1
        });
      });
    });

    describe('interactionCreate event', () => {
      it('should handle command interactions', async () => {
        const interactionHandler = mockClient.on.mock.calls.find((call: any) => call[0] === 'interactionCreate')[1];
        
        const mockInteraction = {
          isCommand: jest.fn(() => true),
          commandName: 'login',
          user: { id: '123456789012345678' },
          reply: jest.fn()
        };
        
        // Mock commands collection
        const mockCommands = new Map();
        mockCommands.set('login', { execute: jest.fn() });
        (discordService as any).commands = mockCommands;
        
        await interactionHandler(mockInteraction);
        
        expect(mockInteraction.isCommand).toHaveBeenCalled();
        expect(mockCommands.get('login').execute).toHaveBeenCalledWith(mockInteraction);
      });

      it('should ignore non-command interactions', async () => {
        const interactionHandler = mockClient.on.mock.calls.find((call: any) => call[0] === 'interactionCreate')[1];
        
        const mockInteraction = {
          isCommand: jest.fn(() => false)
        };
        
        await interactionHandler(mockInteraction);
        
        expect(mockInteraction.isCommand).toHaveBeenCalled();
      });

      it('should handle unknown commands', async () => {
        const interactionHandler = mockClient.on.mock.calls.find((call: any) => call[0] === 'interactionCreate')[1];
        
        const mockInteraction = {
          isCommand: jest.fn(() => true),
          commandName: 'unknown-command',
          reply: jest.fn()
        };
        
        // Mock empty commands collection
        (discordService as any).commands = new Map();
        
        await interactionHandler(mockInteraction);
        
        expect(mockInteraction.reply).toHaveBeenCalledWith({
          content: 'Command not found!',
          ephemeral: true
        });
      });

      it('should handle command execution errors', async () => {
        const interactionHandler = mockClient.on.mock.calls.find((call: any) => call[0] === 'interactionCreate')[1];
        
        const mockInteraction = {
          isCommand: jest.fn(() => true),
          commandName: 'login',
          user: { id: '123456789012345678' },
          reply: jest.fn()
        };
        
        const mockCommand = {
          execute: jest.fn().mockRejectedValue(new Error('Command error'))
        };
        
        const mockCommands = new Map();
        mockCommands.set('login', mockCommand);
        (discordService as any).commands = mockCommands;
        
        await interactionHandler(mockInteraction);
        
        expect(Logger.error).toHaveBeenCalledWith(
          'Error handling interaction',
          expect.any(Error),
          {
            commandName: 'login',
            userId: '123456789012345678'
          }
        );
        
        expect(mockInteraction.reply).toHaveBeenCalledWith({
          content: 'An error occurred while processing your command. Please try again later.',
          ephemeral: true
        });
      });
    });
  });

  describe('registerCommands', () => {
    it('should register commands successfully', async () => {
      // Mock the application commands
      mockClient.application = {
        commands: {
          set: jest.fn().mockResolvedValue(undefined)
        }
      } as any;

      await expect(discordService.registerCommands()).resolves.not.toThrow();
    });
  });
});
