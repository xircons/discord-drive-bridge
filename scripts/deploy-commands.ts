#!/usr/bin/env ts-node

import { REST, Routes } from 'discord.js';
import { config } from '../src/config';
import * as commands from '../src/commands';

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

const rest = new REST({ version: '10' }).setToken(config.discord.token);

async function deployCommands() {
  try {
    console.log('🚀 Started refreshing application (/) commands...');

    // Convert commands to JSON format
    const commandData = commandList.map(command => command.data.toJSON());

    // Deploy commands to the specific guild
    const data = await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
      { body: commandData }
    ) as any[];

    console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
    console.log(`📋 Commands deployed to guild: ${config.discord.guildId}`);
    
    // List deployed commands
    console.log('\n📝 Deployed commands:');
    commandList.forEach(cmd => {
      console.log(`  - /${cmd.data.name}: ${cmd.data.description}`);
    });

  } catch (error) {
    console.error('❌ Failed to deploy commands:', error);
    process.exit(1);
  }
}

// Validate environment before deploying
if (!config.discord.token || !config.discord.clientId || !config.discord.guildId) {
  console.error('❌ Missing required Discord configuration. Please check your .env file.');
  process.exit(1);
}

deployCommands();
