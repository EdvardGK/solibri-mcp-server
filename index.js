/**
 * Solibri MCP Server with SSE Transport
 *
 * Run on Windows machine with Solibri installed.
 * Connect from remote Claude Code via SSE.
 */

const express = require('express');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const config = require('./config');
const autorun = require('./solibri/autorun');
const restClient = require('./solibri/rest-client');

// Initialize Express
const app = express();
app.use(express.json());

// Auth middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);
  if (token !== config.SSE.authToken) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  next();
}

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: config.SERVER_NAME, version: config.SERVER_VERSION });
});

// SSE endpoint (auth required)
const transports = new Map();

app.get('/sse', authenticate, (req, res) => {
  console.log('[SSE] New client connection');

  const transport = new SSEServerTransport('/messages', res);
  const server = createMcpServer();

  transports.set(transport, server);

  transport.onClose = () => {
    console.log('[SSE] Client disconnected');
    transports.delete(transport);
  };

  server.connect(transport);
});

app.post('/messages', authenticate, async (req, res) => {
  // Find the transport for this session
  // In practice, you'd want session management here
  const [transport] = transports.keys();
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).json({ error: 'No active SSE connection' });
  }
});

/**
 * Create MCP Server with Solibri tools
 */
function createMcpServer() {
  const server = new McpServer({
    name: config.SERVER_NAME,
    version: config.SERVER_VERSION,
  });

  // Register tools
  registerTools(server);

  return server;
}

/**
 * Register all Solibri tools
 */
function registerTools(server) {
  // ============================================
  // ASSET MANAGEMENT
  // ============================================

  server.tool(
    'solibri_list_assets',
    'List available Solibri assets (classifications, rulesets, ITOs, templates)',
    {
      type: {
        type: 'string',
        enum: ['classifications', 'rulesets', 'ito', 'templates'],
        description: 'Type of assets to list',
      },
    },
    async ({ type }) => {
      const assets = autorun.listAssets(type);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ type, assets, count: assets.length }, null, 2),
          },
        ],
      };
    }
  );

  // ============================================
  // MODEL CHECKING
  // ============================================

  server.tool(
    'solibri_check_model',
    'Run model checking on an IFC/SMC file with specified rulesets',
    {
      modelPath: {
        type: 'string',
        description: 'Path to IFC or SMC file',
      },
      rulesets: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of ruleset files to apply',
      },
      classifications: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of classification files to apply (optional)',
      },
      outputBcf: {
        type: 'string',
        description: 'Path for BCF output file (optional)',
      },
      outputSmc: {
        type: 'string',
        description: 'Path to save SMC model (optional)',
      },
    },
    async ({ modelPath, rulesets, classifications = [], outputBcf, outputSmc }) => {
      const commands = [];

      // Open model
      commands.push({ type: 'openmodel', file: modelPath });

      // Apply classifications
      for (const cls of classifications) {
        commands.push({ type: 'openclassification', file: cls });
      }

      // Apply rulesets
      for (const rs of rulesets) {
        commands.push({ type: 'openruleset', file: rs });
      }

      // Run check
      commands.push({ type: 'check' });

      // Export BCF if requested
      if (outputBcf) {
        commands.push({ type: 'bcfreport', file: outputBcf, version: '2.1' });
      }

      // Save model if requested
      if (outputSmc) {
        commands.push({ type: 'savemodel', file: outputSmc });
      }

      // Exit
      commands.push({ type: 'exit' });

      try {
        const result = await autorun.executeAutorun(commands);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                jobId: result.jobId,
                outputBcf,
                outputSmc,
                message: 'Model check completed',
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================
  // QUANTITY TAKEOFF
  // ============================================

  server.tool(
    'solibri_quantity_takeoff',
    'Run Information Takeoff (ITO) and export to Excel',
    {
      modelPath: {
        type: 'string',
        description: 'Path to IFC or SMC file',
      },
      itoFile: {
        type: 'string',
        description: 'Path to ITO definition file',
      },
      outputExcel: {
        type: 'string',
        description: 'Path for Excel output file',
      },
      templateFile: {
        type: 'string',
        description: 'Excel template file (optional)',
      },
      itoName: {
        type: 'string',
        description: 'Specific ITO name to run (optional, runs all if not specified)',
      },
      title: {
        type: 'string',
        description: 'Report title (optional)',
      },
    },
    async ({ modelPath, itoFile, outputExcel, templateFile, itoName, title }) => {
      const commands = [];

      // Open model
      commands.push({ type: 'openmodel', file: modelPath });

      // Open ITO
      commands.push({ type: 'openito', file: itoFile });

      // Run takeoff
      commands.push({ type: 'takeoff', name: itoName });

      // Export report
      commands.push({
        type: 'itoreport',
        file: outputExcel,
        templatefile: templateFile,
        name: itoName,
        title: title,
      });

      // Exit
      commands.push({ type: 'exit' });

      try {
        const result = await autorun.executeAutorun(commands);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                jobId: result.jobId,
                outputExcel,
                message: 'Quantity takeoff completed',
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================
  // MODEL MANAGEMENT
  // ============================================

  server.tool(
    'solibri_create_model',
    'Create a new Solibri model from multiple IFC files',
    {
      ifcFiles: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of IFC file paths to combine',
      },
      outputSmc: {
        type: 'string',
        description: 'Path for output SMC file',
      },
      classifications: {
        type: 'array',
        items: { type: 'string' },
        description: 'Classification files to apply (optional)',
      },
    },
    async ({ ifcFiles, outputSmc, classifications = [] }) => {
      const commands = [];

      // Open all IFC files
      for (const ifc of ifcFiles) {
        commands.push({ type: 'openmodel', file: ifc });
      }

      // Apply classifications
      for (const cls of classifications) {
        commands.push({ type: 'openclassification', file: cls });
      }

      // Save combined model
      commands.push({ type: 'savemodel', file: outputSmc });
      commands.push({ type: 'exit' });

      try {
        const result = await autorun.executeAutorun(commands);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                jobId: result.jobId,
                outputSmc,
                ifcCount: ifcFiles.length,
                message: 'Model created successfully',
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'solibri_update_model',
    'Update an existing SMC model with new/updated IFC files',
    {
      smcPath: {
        type: 'string',
        description: 'Path to existing SMC file',
      },
      ifcFiles: {
        type: 'array',
        items: { type: 'string' },
        description: 'IFC files to update/add',
      },
      outputSmc: {
        type: 'string',
        description: 'Path for output SMC file (can be same as input)',
      },
    },
    async ({ smcPath, ifcFiles, outputSmc }) => {
      const commands = [];

      // Open existing model
      commands.push({ type: 'openmodel', file: smcPath });

      // Update with IFC files
      for (const ifc of ifcFiles) {
        commands.push({ type: 'updatemodel', file: ifc });
      }

      // Save
      commands.push({ type: 'savemodel', file: outputSmc || smcPath });
      commands.push({ type: 'exit' });

      try {
        const result = await autorun.executeAutorun(commands);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                jobId: result.jobId,
                outputSmc: outputSmc || smcPath,
                updatedFiles: ifcFiles.length,
                message: 'Model updated successfully',
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================
  // AUTORUN (RAW)
  // ============================================

  server.tool(
    'solibri_autorun',
    'Execute raw Autorun commands (advanced)',
    {
      commands: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            file: { type: 'string' },
            name: { type: 'string' },
            version: { type: 'string' },
          },
        },
        description: 'Array of Autorun commands',
      },
    },
    async ({ commands }) => {
      try {
        const result = await autorun.executeAutorun(commands);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                jobId: result.jobId,
                stdout: result.stdout,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================
  // REST API (when Solibri is running)
  // ============================================

  server.tool(
    'solibri_status',
    'Get status of running Solibri instance (requires REST API enabled)',
    {},
    async () => {
      try {
        const [pingResult, aboutResult, statusResult] = await Promise.all([
          restClient.ping().catch(() => null),
          restClient.about().catch(() => null),
          restClient.status().catch(() => null),
        ]);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                running: !!pingResult,
                about: aboutResult,
                status: statusResult,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                running: false,
                error: error.message,
                hint: 'Start Solibri with --rest-api-server-port flag',
              }, null, 2),
            },
          ],
        };
      }
    }
  );

  server.tool(
    'solibri_select_components',
    'Select components in Solibri by GUID (requires REST API)',
    {
      guids: {
        type: 'array',
        items: { type: 'string' },
        description: 'IFC GUIDs to select',
      },
    },
    async ({ guids }) => {
      try {
        await restClient.setSelectionBasket(guids);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                selectedCount: guids.length,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'solibri_get_bcf',
    'Export BCF from current Solibri session (requires REST API)',
    {
      version: {
        type: 'string',
        enum: ['2', '2.1'],
        description: 'BCF version',
      },
    },
    async ({ version = '2.1' }) => {
      try {
        const bcf = await restClient.getBcf(version);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                bcfVersion: version,
                data: bcf,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}

// Start server
const port = config.SSE.port;
const host = config.SSE.host;

app.listen(port, host, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           Solibri MCP Server (SSE Transport)                ║
╠══════════════════════════════════════════════════════════════╣
║  Server:     http://${host}:${port}
║  SSE:        http://${host}:${port}/sse
║  Health:     http://${host}:${port}/health
╠══════════════════════════════════════════════════════════════╣
║  Auth Token: ${config.SSE.authToken.substring(0, 8)}...
╚══════════════════════════════════════════════════════════════╝

Add to Claude Code settings.json:
{
  "mcpServers": {
    "solibri": {
      "type": "sse",
      "url": "http://<this-ip>:${port}/sse",
      "headers": {
        "Authorization": "Bearer ${config.SSE.authToken}"
      }
    }
  }
}
`);
});
