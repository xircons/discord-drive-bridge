#!/usr/bin/env node

/**
 * Server Startup Script
 * 
 * This script helps start the server on an available port.
 * It will try port 3000 first, then increment if needed.
 */

const { spawn } = require('child_process');
const net = require('net');

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once('close', () => {
        resolve(false);
      });
      server.close();
    });
    server.on('error', () => {
      resolve(true);
    });
  });
}

async function findAvailablePort(startPort = 3000) {
  let port = startPort;
  while (port < startPort + 10) {
    if (!(await isPortInUse(port))) {
      return port;
    }
    port++;
  }
  throw new Error(`No available port found between ${startPort} and ${startPort + 9}`);
}

async function startServer() {
  try {
    const port = await findAvailablePort(3000);
    console.log(`🚀 Starting server on port ${port}`);
    
    // Set the port in environment
    process.env.PORT = port.toString();
    
    // Start the server
    const child = spawn('npm', ['run', 'dev'], {
      stdio: 'inherit',
      env: { ...process.env, PORT: port.toString() }
    });
    
    child.on('error', (error) => {
      console.error('❌ Failed to start server:', error.message);
      process.exit(1);
    });
    
    child.on('exit', (code) => {
      console.log(`Server exited with code ${code}`);
      process.exit(code);
    });
    
  } catch (error) {
    console.error('❌ Error starting server:', error.message);
    process.exit(1);
  }
}

startServer();
