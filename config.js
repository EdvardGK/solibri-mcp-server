/**
 * Configuration for Solibri MCP Server
 */

const path = require('path');
const crypto = require('crypto');

// Generate a default token if not set (for first run)
const defaultToken = crypto.randomBytes(32).toString('hex');

module.exports = {
  SERVER_NAME: 'solibri-mcp-server',
  SERVER_VERSION: '1.0.0',

  // SSE Server Configuration
  SSE: {
    port: parseInt(process.env.SOLIBRI_MCP_PORT) || 3000,
    host: process.env.SOLIBRI_MCP_HOST || '0.0.0.0',
    // Auth token - MUST be set in production
    authToken: process.env.SOLIBRI_MCP_TOKEN || defaultToken,
  },

  // Solibri Configuration
  SOLIBRI: {
    // Path to Solibri executable
    exePath: process.env.SOLIBRI_EXE_PATH || 'C:\\Program Files\\Solibri\\SOLIBRI\\Solibri.exe',

    // REST API settings (when Solibri is running with --rest-api-server-port)
    restApiPort: parseInt(process.env.SOLIBRI_REST_PORT) || 10876,
    restApiUrl: `http://localhost:${parseInt(process.env.SOLIBRI_REST_PORT) || 10876}`,

    // Working directories
    workDir: process.env.SOLIBRI_WORK_DIR || path.join(__dirname, 'work'),
    autorunDir: process.env.SOLIBRI_AUTORUN_DIR || path.join(__dirname, 'autorun'),
    outputDir: process.env.SOLIBRI_OUTPUT_DIR || path.join(__dirname, 'output'),

    // Default asset locations (can be overridden per-call)
    classificationsDir: process.env.SOLIBRI_CLASSIFICATIONS_DIR || 'C:\\Users\\Public\\Solibri\\SOLIBRI\\Classifications',
    rulesetsDir: process.env.SOLIBRI_RULESETS_DIR || 'C:\\Users\\Public\\Solibri\\SOLIBRI\\Rulesets',
    itoDir: process.env.SOLIBRI_ITO_DIR || 'C:\\Users\\Public\\Solibri\\SOLIBRI\\Information Takeoff',
    templatesDir: process.env.SOLIBRI_TEMPLATES_DIR || 'C:\\Users\\Public\\Solibri\\SOLIBRI\\Templates',
  },

  // Autorun settings
  AUTORUN: {
    // Timeout for autorun execution (ms) - default 30 minutes
    timeout: parseInt(process.env.SOLIBRI_AUTORUN_TIMEOUT) || 30 * 60 * 1000,
    // Keep generated XML files for debugging
    keepXmlFiles: process.env.SOLIBRI_KEEP_XML === 'true',
  },

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};
