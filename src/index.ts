import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { Logger } from './utils/logger';
import { DiscordService } from './services/discordService';
import { OAuthService } from './services/oauthService';
import { CacheService } from './services/cacheService';
import { MonitoringService } from './services/monitoringService';
import { BackupService } from './services/backupService';
import { SecurityService } from './services/securityService';
import { SecurityMiddleware } from './middleware/securityMiddleware';
import { UserModel } from './database/connection';
import { ValidationService } from './utils/validation';

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Enhanced security middleware
app.use(SecurityMiddleware.securityHeaders);
app.use(SecurityMiddleware.addSecurityContext);
app.use(SecurityMiddleware.sanitizeRequest);
app.use(SecurityMiddleware.detectSuspiciousActivity);

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? [config.baseUrl] : true,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.max,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: config.security.rateLimit.message
    },
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize services
const cacheService = CacheService.getInstance();
const monitoringService = MonitoringService.getInstance();
const backupService = BackupService.getInstance();
const securityService = SecurityService.getInstance();

// Health check endpoint
app.get('/health', (_req, res) => {
  const health = monitoringService.getHealthStatus();
  res.json({
    status: health.status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env['npm_package_version'] || '1.0.0',
    metrics: health.metrics
  });
});

// Metrics endpoint for Prometheus
app.get('/metrics', (_req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(monitoringService.exportPrometheus());
});

// Security stats endpoint (admin only)
app.get('/security/stats', async (_req, res) => {
  try {
    const stats = securityService.getSecurityStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
    return;
  } catch (error) {
    Logger.error('Failed to get security stats', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security statistics'
    });
    return;
  }
});

// OAuth callback endpoint
app.get('/auth/callback', SecurityMiddleware.csrfProtection, async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      Logger.error('OAuth callback error', new Error(error as string), { error });
      return res.status(400).json({
        success: false,
        error: {
          code: 'OAUTH_ERROR',
          message: 'Authentication failed',
          details: error
        },
        timestamp: new Date().toISOString()
      });
    }

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Missing required parameters'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Extract user ID from state
    const [userIdStr] = (state as string).split(':');
    if (!userIdStr) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: 'Invalid state parameter'
        },
        timestamp: new Date().toISOString()
      });
    }
    const userId = BigInt(userIdStr);

    // Retrieve code verifier from Redis cache
    const codeVerifierKey = `oauth_code_verifier:${userId}`;
    const codeVerifier = await cacheService.get(codeVerifierKey);
    
    Logger.info('Code verifier lookup', { 
      userId: userId.toString(), 
      key: codeVerifierKey,
      found: !!codeVerifier 
    });
    
    if (!codeVerifier) {
      Logger.error('Code verifier not found', new Error('Code verifier expired or not found'), { 
        userId: userId.toString(),
        key: codeVerifierKey 
      });
      return res.status(400).json({
        success: false,
        error: {
          code: 'CODE_VERIFIER_NOT_FOUND',
          message: 'Authentication session expired. Please try logging in again.'
        },
        timestamp: new Date().toISOString()
      });
    }

    const oauthService = new OAuthService();
    const { user } = await oauthService.exchangeCodeForTokens(
      code as string,
      codeVerifier,
      state as string
    );

    // Clean up code verifier from cache
    await cacheService.del(codeVerifierKey);

    // Log successful authentication
    Logger.audit(userId, 'oauth_callback_success', {
      email: user.google_email,
      success: true
    });

    // Redirect back to Discord server
    const discordServerUrl = `https://discord.com/channels/${config.discord.guildId}`;
    
    // Create a success page that shows a message and redirects to Discord
    const successHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Google Drive Connected</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000&display=swap" rel="stylesheet">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: 'Nunito Sans', sans-serif;
                background: #2a2a2a;
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }

            .container {
                background: #3a3a3a;
                border-radius: 16px;
                padding: 3rem 2.5rem;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                text-align: center;
                max-width: 420px;
                width: 90%;
                border: 1px solid #4a4a4a;
            }

            .success-indicator {
                width: 64px;
                height: 64px;
                margin: 0 auto 2rem;
                background: white;
                border-radius: 50%;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: scaleIn 0.5s ease-out;
            }

            @keyframes scaleIn {
                0% {
                    transform: scale(0);
                    opacity: 0;
                }
                100% {
                    transform: scale(1);
                    opacity: 1;
                }
            }

            .success-indicator::after {
                content: '';
                width: 20px;
                height: 10px;
                border: 3px solid #2a2a2a;
                border-top: none;
                border-right: none;
                transform: rotate(-45deg);
                animation: checkmarkDraw 0.3s ease-out 0.2s both;
            }

            @keyframes checkmarkDraw {
                0% {
                    width: 0;
                    height: 0;
                    opacity: 0;
                }
                50% {
                    width: 10px;
                    height: 0;
                    opacity: 1;
                }
                100% {
                    width: 20px;
                    height: 10px;
                    opacity: 1;
                }
            }

            h1 {
                color: #ffffff;
                margin-bottom: 1rem;
                font-size: 1.8rem;
                font-weight: 700;
                letter-spacing: -0.02em;
            }

            p {
                color: #b0b0b0;
                margin-bottom: 2.5rem;
                line-height: 1.6;
                font-size: 1rem;
            }

            .discord-button {
                background: white;
                color: #2a2a2a;
                padding: 14px 32px;
                border: none;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
                transition: opacity 0.2s ease;
                font-family: 'Nunito Sans', sans-serif;
            }

            .discord-button:hover {
                opacity: 0.9;
            }

            .countdown {
                color: #888;
                font-size: 0.9rem;
                margin-top: 1.5rem;
            }

            #countdown {
                color: #ffffff;
                font-weight: 600;
            }

            /* Responsive design */
            @media (max-width: 480px) {
                .container {
                    padding: 2rem 1.5rem;
                    margin: 1rem;
                }
                
                h1 {
                    font-size: 1.5rem;
                }
                
                .success-indicator {
                    width: 56px;
                    height: 56px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="success-indicator"></div>
            <h1>Google Drive Connected!</h1>
            <p>Your Google Drive account (${user.google_email}) has been successfully connected to the Discord bot.</p>
            <a href="${discordServerUrl}" class="discord-button">Return to Discord Server</a>
            <div class="countdown">Redirecting automatically in <span id="countdown">5</span> seconds...</div>
        </div>

        <script>
            let timeLeft = 5;
            const countdownElement = document.getElementById('countdown');
            const timer = setInterval(() => {
                timeLeft--;
                countdownElement.textContent = timeLeft;
                if (timeLeft <= 0) {
                    clearInterval(timer);
                    window.location.href = '${discordServerUrl}';
                }
            }, 1000);
        </script>
    </body>
    </html>
    `;

    res.send(successHtml);
    return;

  } catch (error) {
    Logger.error('OAuth callback failed', error as Error, {
      code: (req.query['code'] as string)?.substring(0, 10) + '...',
      state: req.query['state']
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during authentication'
      },
      timestamp: new Date().toISOString()
    });
    return;
  }
});

// OAuth start endpoint
app.get('/auth/start/:userId', SecurityMiddleware.csrfProtection, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate user ID
    const idValidation = ValidationService.validateDiscordId(userId);
    if (!idValidation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER_ID',
          message: idValidation.error
        },
        timestamp: new Date().toISOString()
      });
    }

    const oauthService = new OAuthService();
    const { url } = oauthService.generateAuthUrl(BigInt(userId));

    // In production, store code verifier in Redis or database
    // For this implementation, we'll include it in the response
    // This is a simplified approach - in production, use proper session management

    res.json({
      success: true,
      data: {
        authUrl: url,
        expiresIn: 600 // 10 minutes
      },
      timestamp: new Date().toISOString()
    });
    return;

  } catch (error) {
    Logger.error('OAuth start failed', error as Error, { userId: req.params.userId });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate authentication URL'
      },
      timestamp: new Date().toISOString()
    });
    return;
  }
});

// Token refresh endpoint
app.post('/auth/refresh/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate user ID
    const idValidation = ValidationService.validateDiscordId(userId);
    if (!idValidation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER_ID',
          message: idValidation.error
        },
        timestamp: new Date().toISOString()
      });
    }

    const user = await UserModel.findById(BigInt(userId));
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        },
        timestamp: new Date().toISOString()
      });
    }

    const oauthService = new OAuthService();
    const { accessToken, expiresAt } = await oauthService.refreshAccessToken(user);

    res.json({
      success: true,
      data: {
        accessToken,
        expiresAt: expiresAt.toISOString()
      },
      timestamp: new Date().toISOString()
    });
    return;

  } catch (error) {
    Logger.error('Token refresh failed', error as Error, { userId: req.params.userId });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to refresh token'
      },
      timestamp: new Date().toISOString()
    });
    return;
  }
});

// Revoke tokens endpoint
app.delete('/auth/revoke/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate user ID
    const idValidation = ValidationService.validateDiscordId(userId);
    if (!idValidation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER_ID',
          message: idValidation.error
        },
        timestamp: new Date().toISOString()
      });
    }

    const user = await UserModel.findById(BigInt(userId));
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        },
        timestamp: new Date().toISOString()
      });
    }

    const oauthService = new OAuthService();
    await oauthService.revokeTokens(user);

    res.json({
      success: true,
      data: {
        message: 'Tokens revoked successfully'
      },
      timestamp: new Date().toISOString()
    });
    return;

  } catch (error) {
    Logger.error('Token revocation failed', error as Error, { userId: req.params.userId });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to revoke tokens'
      },
      timestamp: new Date().toISOString()
    });
    return;
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  Logger.error('Unhandled error', error, {
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    },
    timestamp: new Date().toISOString()
  });
});

// Initialize Discord bot
const discordService = new DiscordService();

// Startup function
async function startApp() {
  try {
    // Connect to Redis
    await cacheService.connect();
    Logger.info('Cache service connected');

    // Start monitoring
    setInterval(() => {
      monitoringService.recordMemoryUsage();
      monitoringService.recordUptime();
    }, 30000); // Every 30 seconds

    // Login to Discord and register commands
    await discordService.login();
    await discordService.registerCommands();
    
    // Start Express server
    const server = app.listen(config.port, () => {
      Logger.info(`Server running on port ${config.port}`, {
        port: config.port,
        nodeEnv: config.nodeEnv,
        baseUrl: config.baseUrl
      });
    });

    // Graceful shutdown
    const shutdown = async () => {
      Logger.info('Shutting down gracefully...');
      
      server.close(async () => {
        await discordService.getClient().destroy();
        await cacheService.disconnect();
        backupService.stopAllJobs();
        securityService.cleanup();
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    Logger.error('Failed to start application', error as Error);
    process.exit(1);
  }
}

// Start the application
startApp();

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Unhandled Promise Rejection', new Error(reason as string), {
    promise: promise.toString()
  });
  monitoringService.recordError(new Error(reason as string), 'unhandledRejection');
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  Logger.error('Uncaught Exception', error);
  monitoringService.recordError(error, 'uncaughtException');
  process.exit(1);
});

