// Authentication Commands
export { loginCommand } from './login';
export { logoutCommand } from './logout';
export { statusCommand } from './status';

// File Management Commands
export { uploadCommand } from './upload';
export { downloadCommand } from './download';
export { deleteCommand } from './delete';
export { listCommand } from './list';

// Advanced Operations
export { createFolderCommand } from './createFolder';
export { searchCommand } from './search';

// Bulk Operations
export { bulkUploadCommand } from './bulkUpload';

// Utility Commands
export { storageCommand } from './storage';
export { backupCommand } from './backup';
export { helpCommand } from './help';

// Command registry
export const allCommands = [
  // Authentication
  'login',
  'logout', 
  'status',
  
  // File Management
  'upload',
  'download',
  'delete',
  'list',
  
  // Advanced Operations
  'create-folder',
  'search',
  
  // Bulk Operations
  'bulk-upload',
  
  // Utility
  'storage',
  'backup',
  'help'
];
