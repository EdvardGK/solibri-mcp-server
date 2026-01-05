/**
 * Solibri MCP Server with SSE Transport
 *
 * Run on Windows machine with Solibri installed.
 * Connect from remote Claude Code via SSE.
 */

const express = require('express');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const config = require('./config');
const autorun = require('./solibri/autorun');
const restClient = require('./solibri/rest-client');

// Define all tools
const TOOLS = [
  {
    name: 'solibri_list_assets',
    description: 'List available Solibri assets (classifications, rulesets, ITOs, templates)',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['classifications', 'rulesets', 'ito', 'templates'],
          description: 'Type of assets to list',
        },
      },
      required: ['type'],
    },
    handler: async ({ type }) => {
      const assets = autorun.listAssets(type);
      return {
        content: [{ type: 'text', text: JSON.stringify({ type, assets, count: assets.length }, null, 2) }],
      };
    },
  },
  {
    name: 'solibri_check_model',
    description: 'Run model checking on an IFC/SMC file with specified rulesets',
    inputSchema: {
      type: 'object',
      properties: {
        modelPath: { type: 'string', description: 'Path to IFC or SMC file' },
        rulesets: { type: 'array', items: { type: 'string' }, description: 'List of ruleset files to apply' },
        classifications: { type: 'array', items: { type: 'string' }, description: 'Classification files (optional)' },
        outputBcf: { type: 'string', description: 'Path for BCF output file (optional)' },
        outputSmc: { type: 'string', description: 'Path to save SMC model (optional)' },
      },
      required: ['modelPath', 'rulesets'],
    },
    handler: async ({ modelPath, rulesets, classifications = [], outputBcf, outputSmc }) => {
      const commands = [{ type: 'openmodel', file: modelPath }];
      for (const cls of classifications) commands.push({ type: 'openclassification', file: cls });
      for (const rs of rulesets) commands.push({ type: 'openruleset', file: rs });
      commands.push({ type: 'check' });
      if (outputBcf) commands.push({ type: 'bcfreport', file: outputBcf, version: '2.1' });
      if (outputSmc) commands.push({ type: 'savemodel', file: outputSmc });
      commands.push({ type: 'exit' });

      try {
        const result = await autorun.executeAutorun(commands);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, jobId: result.jobId, outputBcf, outputSmc }, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
      }
    },
  },
  {
    name: 'solibri_quantity_takeoff',
    description: 'Run Information Takeoff (ITO) and export to Excel',
    inputSchema: {
      type: 'object',
      properties: {
        modelPath: { type: 'string', description: 'Path to IFC or SMC file' },
        itoFile: { type: 'string', description: 'Path to ITO definition file' },
        outputExcel: { type: 'string', description: 'Path for Excel output file' },
        templateFile: { type: 'string', description: 'Excel template file (optional)' },
        itoName: { type: 'string', description: 'Specific ITO name to run (optional)' },
        title: { type: 'string', description: 'Report title (optional)' },
      },
      required: ['modelPath', 'itoFile', 'outputExcel'],
    },
    handler: async ({ modelPath, itoFile, outputExcel, templateFile, itoName, title }) => {
      const commands = [
        { type: 'openmodel', file: modelPath },
        { type: 'openito', file: itoFile },
        { type: 'takeoff', name: itoName },
        { type: 'itoreport', file: outputExcel, templatefile: templateFile, name: itoName, title },
        { type: 'exit' },
      ];

      try {
        const result = await autorun.executeAutorun(commands);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, jobId: result.jobId, outputExcel }, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
      }
    },
  },
  {
    name: 'solibri_create_model',
    description: 'Create a new Solibri model from multiple IFC files',
    inputSchema: {
      type: 'object',
      properties: {
        ifcFiles: { type: 'array', items: { type: 'string' }, description: 'List of IFC file paths' },
        outputSmc: { type: 'string', description: 'Path for output SMC file' },
        classifications: { type: 'array', items: { type: 'string' }, description: 'Classification files (optional)' },
      },
      required: ['ifcFiles', 'outputSmc'],
    },
    handler: async ({ ifcFiles, outputSmc, classifications = [] }) => {
      const commands = [];
      for (const ifc of ifcFiles) commands.push({ type: 'openmodel', file: ifc });
      for (const cls of classifications) commands.push({ type: 'openclassification', file: cls });
      commands.push({ type: 'savemodel', file: outputSmc });
      commands.push({ type: 'exit' });

      try {
        const result = await autorun.executeAutorun(commands);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, jobId: result.jobId, outputSmc, ifcCount: ifcFiles.length }, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
      }
    },
  },
  {
    name: 'solibri_update_model',
    description: 'Update an existing SMC model with new/updated IFC files',
    inputSchema: {
      type: 'object',
      properties: {
        smcPath: { type: 'string', description: 'Path to existing SMC file' },
        ifcFiles: { type: 'array', items: { type: 'string' }, description: 'IFC files to update/add' },
        outputSmc: { type: 'string', description: 'Path for output SMC file (optional, defaults to input)' },
      },
      required: ['smcPath', 'ifcFiles'],
    },
    handler: async ({ smcPath, ifcFiles, outputSmc }) => {
      const commands = [{ type: 'openmodel', file: smcPath }];
      for (const ifc of ifcFiles) commands.push({ type: 'updatemodel', file: ifc });
      commands.push({ type: 'savemodel', file: outputSmc || smcPath });
      commands.push({ type: 'exit' });

      try {
        const result = await autorun.executeAutorun(commands);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, jobId: result.jobId, outputSmc: outputSmc || smcPath }, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
      }
    },
  },
  {
    name: 'solibri_status',
    description: 'Get status of running Solibri instance (requires REST API enabled)',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      try {
        const [ping, about, status] = await Promise.all([
          restClient.ping().catch(() => null),
          restClient.about().catch(() => null),
          restClient.status().catch(() => null),
        ]);
        return {
          content: [{ type: 'text', text: JSON.stringify({ running: !!ping, about, status }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ running: false, error: error.message }, null, 2) }],
        };
      }
    },
  },
];

// Initialize Express
const app = express();
app.use(express.json());

// Auth middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const token = authHeader.substring(7);
  if (token !== config.SSE.authToken) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  next();
}

// Health check (no auth)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: config.SERVER_NAME, version: config.SERVER_VERSION });
});

// Store active transports
const transports = new Map();

// SSE endpoint
app.get('/sse', authenticate, async (req, res) => {
  console.log('[SSE] New client connection');

  const transport = new SSEServerTransport('/messages', res);

  // Create server instance for this connection
  const server = new Server(
    { name: config.SERVER_NAME, version: config.SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  // Handle all requests
  server.fallbackRequestHandler = async (request) => {
    const { method, params } = request;
    console.log(`[MCP] ${method}`);

    if (method === 'initialize') {
      return {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: config.SERVER_NAME, version: config.SERVER_VERSION },
      };
    }

    if (method === 'tools/list') {
      return {
        tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      };
    }

    if (method === 'resources/list') return { resources: [] };
    if (method === 'prompts/list') return { prompts: [] };

    if (method === 'tools/call') {
      const { name, arguments: args = {} } = params || {};
      const tool = TOOLS.find((t) => t.name === name);
      if (tool) {
        try {
          return await tool.handler(args);
        } catch (error) {
          return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
        }
      }
      return { error: { code: -32601, message: `Tool not found: ${name}` } };
    }

    return { error: { code: -32601, message: `Method not found: ${method}` } };
  };

  transports.set(transport, server);

  req.on('close', () => {
    console.log('[SSE] Client disconnected');
    transports.delete(transport);
  });

  await server.connect(transport);
});

// Messages endpoint for SSE
app.post('/messages', authenticate, async (req, res) => {
  const [transport] = transports.keys();
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).json({ error: 'No active SSE connection' });
  }
});

// Start server
const port = config.SSE.port;
const host = config.SSE.host;

app.listen(port, host, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           Solibri MCP Server (SSE Transport)                 ║
╠══════════════════════════════════════════════════════════════╣
║  Server:     http://${host}:${port}
║  SSE:        http://${host}:${port}/sse
║  Health:     http://${host}:${port}/health
╠══════════════════════════════════════════════════════════════╣
║  Auth Token: ${config.SSE.authToken.substring(0, 8)}...
╚══════════════════════════════════════════════════════════════╝

Configure Claude Code (~/.claude/settings.json):
{
  "mcpServers": {
    "solibri": {
      "type": "sse",
      "url": "http://<windows-ip>:${port}/sse",
      "headers": {
        "Authorization": "Bearer ${config.SSE.authToken}"
      }
    }
  }
}
`);
});
