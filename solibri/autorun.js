/**
 * Solibri Autorun XML Generator and Executor
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

// Ensure directories exist
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Generate Autorun XML from commands
 */
function generateXml(commands) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<autorun>'];

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'openmodel':
        lines.push(`  <openmodel file="${escapeXml(cmd.file)}" />`);
        break;

      case 'updatemodel':
        lines.push(`  <updatemodel file="${escapeXml(cmd.file)}" />`);
        break;

      case 'savemodel':
        lines.push(`  <savemodel file="${escapeXml(cmd.file)}" />`);
        break;

      case 'openclassification':
        lines.push(`  <openclassification file="${escapeXml(cmd.file)}" />`);
        break;

      case 'openruleset':
        lines.push(`  <openruleset file="${escapeXml(cmd.file)}" />`);
        break;

      case 'openito':
        lines.push(`  <openito file="${escapeXml(cmd.file)}" />`);
        break;

      case 'check':
        lines.push('  <check />');
        break;

      case 'takeoff':
        if (cmd.name) {
          lines.push(`  <takeoff name="${escapeXml(cmd.name)}" />`);
        } else {
          lines.push('  <takeoff />');
        }
        break;

      case 'itoreport':
        let itoReportAttrs = `file="${escapeXml(cmd.file)}"`;
        if (cmd.templatefile) {
          itoReportAttrs += ` templatefile="${escapeXml(cmd.templatefile)}"`;
        }
        if (cmd.title) {
          itoReportAttrs += ` title="${escapeXml(cmd.title)}"`;
        }
        if (cmd.name) {
          itoReportAttrs += ` name="${escapeXml(cmd.name)}"`;
        }
        lines.push(`  <itoreport ${itoReportAttrs} />`);
        break;

      case 'bcfreport':
        let bcfAttrs = `file="${escapeXml(cmd.file)}"`;
        if (cmd.version) {
          bcfAttrs += ` version="${cmd.version}"`;
        }
        lines.push(`  <bcfreport ${bcfAttrs} />`);
        break;

      case 'createpresentation':
        lines.push('  <createpresentation />');
        break;

      case 'updatepresentation':
        lines.push('  <updatepresentation />');
        break;

      case 'autocomment':
        let acAttrs = '';
        if (cmd.snapshots !== undefined) {
          acAttrs += ` snapshots="${cmd.snapshots}"`;
        }
        lines.push(`  <autocomment${acAttrs} />`);
        break;

      case 'autoupdatemodels':
        lines.push('  <autoupdatemodels />');
        break;

      case 'exit':
        lines.push('  <exit />');
        break;

      default:
        console.warn(`Unknown command type: ${cmd.type}`);
    }
  }

  lines.push('</autorun>');
  return lines.join('\n');
}

/**
 * Escape special XML characters
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Execute Solibri with Autorun XML
 */
async function executeAutorun(commands, options = {}) {
  ensureDir(config.SOLIBRI.autorunDir);
  ensureDir(config.SOLIBRI.outputDir);

  const jobId = uuidv4();
  const xmlPath = path.join(config.SOLIBRI.autorunDir, `${jobId}.xml`);

  // Generate and save XML
  const xml = generateXml(commands);
  fs.writeFileSync(xmlPath, xml, 'utf8');

  console.log(`[Autorun ${jobId}] Generated XML:`, xmlPath);
  console.log(xml);

  return new Promise((resolve, reject) => {
    const args = ['--autorun', xmlPath];

    // Add REST API flags if requested
    if (options.enableRestApi) {
      args.push(`--rest-api-server-port=${config.SOLIBRI.restApiPort}`);
      args.push('--rest-api-server-http');
    }

    console.log(`[Autorun ${jobId}] Executing: "${config.SOLIBRI.exePath}" ${args.join(' ')}`);

    const proc = spawn(config.SOLIBRI.exePath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`[Autorun ${jobId}] stdout:`, data.toString());
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`[Autorun ${jobId}] stderr:`, data.toString());
    });

    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Autorun timed out after ${config.AUTORUN.timeout}ms`));
    }, config.AUTORUN.timeout);

    proc.on('close', (code) => {
      clearTimeout(timeout);

      // Cleanup XML if not keeping
      if (!config.AUTORUN.keepXmlFiles) {
        try {
          fs.unlinkSync(xmlPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      if (code === 0) {
        resolve({
          jobId,
          success: true,
          code,
          stdout,
          stderr,
        });
      } else {
        reject(new Error(`Autorun exited with code ${code}: ${stderr || stdout}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start Solibri: ${err.message}`));
    });
  });
}

/**
 * List available assets (classifications, rulesets, ITOs)
 */
function listAssets(type) {
  const dirs = {
    classifications: config.SOLIBRI.classificationsDir,
    rulesets: config.SOLIBRI.rulesetsDir,
    ito: config.SOLIBRI.itoDir,
    templates: config.SOLIBRI.templatesDir,
  };

  const dir = dirs[type];
  if (!dir || !fs.existsSync(dir)) {
    return [];
  }

  const extensions = {
    classifications: ['.classification'],
    rulesets: ['.cset'],
    ito: ['.ito'],
    templates: ['.xlsx', '.xls'],
  };

  const exts = extensions[type] || [];
  const files = fs.readdirSync(dir);

  return files
    .filter((f) => exts.some((ext) => f.toLowerCase().endsWith(ext)))
    .map((f) => ({
      name: f,
      path: path.join(dir, f),
    }));
}

module.exports = {
  generateXml,
  executeAutorun,
  listAssets,
  ensureDir,
};
