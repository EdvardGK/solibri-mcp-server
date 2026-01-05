# Solibri MCP Server

MCP server for Solibri automation. Runs on Windows alongside Solibri Office, accessible remotely via SSE transport.

## Features

- **Model Checking**: Run rulesets and export BCF issues
- **Quantity Takeoff**: Execute ITOs and export to Excel
- **Model Management**: Create/update SMC files from IFCs
- **Asset Management**: List classifications, rulesets, ITOs
- **REST API Integration**: Control running Solibri instance

## Requirements

- Windows with Solibri Office installed
- Node.js 18+
- Valid Solibri license

## Installation

```powershell
# Clone the repo
git clone https://github.com/YOUR_USERNAME/solibri-mcp-server.git
cd solibri-mcp-server

# Install dependencies
npm install

# Configure
copy .env.example .env
# Edit .env with your settings
```

## Configuration

Edit `.env`:

```env
# Generate a secure token
SOLIBRI_MCP_TOKEN=your-secure-token-here

# Solibri executable path
SOLIBRI_EXE_PATH=C:\Program Files\Solibri\SOLIBRI\Solibri.exe

# Server port
SOLIBRI_MCP_PORT=3000
```

Generate a secure token:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Running

```powershell
npm start
```

The server will display connection info:
```
╔══════════════════════════════════════════════════════════════╗
║           Solibri MCP Server (SSE Transport)                ║
╠══════════════════════════════════════════════════════════════╣
║  Server:     http://0.0.0.0:3000
║  SSE:        http://0.0.0.0:3000/sse
║  Health:     http://0.0.0.0:3000/health
╚══════════════════════════════════════════════════════════════╝
```

## Claude Code Configuration

On your local machine, add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "solibri": {
      "type": "sse",
      "url": "http://YOUR_WINDOWS_IP:3000/sse",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

## Available Tools

### `solibri_list_assets`
List available classifications, rulesets, ITOs, or templates.

### `solibri_check_model`
Run model checking with specified rulesets.

```json
{
  "modelPath": "C:\\Models\\building.ifc",
  "rulesets": ["C:\\Rulesets\\my-rules.cset"],
  "outputBcf": "C:\\Output\\issues.bcf"
}
```

### `solibri_quantity_takeoff`
Run ITO and export to Excel.

```json
{
  "modelPath": "C:\\Models\\building.ifc",
  "itoFile": "C:\\ITO\\quantities.ito",
  "outputExcel": "C:\\Output\\quantities.xlsx"
}
```

### `solibri_create_model`
Combine multiple IFCs into one SMC.

### `solibri_update_model`
Update existing SMC with new IFC versions.

### `solibri_autorun`
Execute raw Autorun commands (advanced).

### `solibri_status`
Get status of running Solibri (requires REST API).

### `solibri_select_components`
Select components by GUID in running Solibri.

### `solibri_get_bcf`
Export BCF from running Solibri session.

## Security

- Always use a strong, randomly generated token
- Run behind VPN or SSH tunnel for remote access
- Never expose port 3000 directly to internet

## Running as Windows Service

Use [NSSM](https://nssm.cc/) to run as a service:

```powershell
nssm install SolibriMCP "C:\Program Files\nodejs\node.exe"
nssm set SolibriMCP AppParameters "C:\path\to\solibri-mcp-server\index.js"
nssm set SolibriMCP AppDirectory "C:\path\to\solibri-mcp-server"
nssm start SolibriMCP
```

## License

MIT
