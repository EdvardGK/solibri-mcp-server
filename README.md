> # ⚠️ DEPRECATED
>
> **This MCP server is no longer maintained.** Active work moved to the more capable toolkit:
>
> ### → [`EdvardGK/solibri-toolkit`](https://github.com/EdvardGK/solibri-toolkit)
>
> The replacement is broader in scope and architecturally different:
>
> | | This repo (deprecated) | [`solibri-toolkit`](https://github.com/EdvardGK/solibri-toolkit) |
> |---|---|---|
> | Stack | Node.js MCP server (SSE) | Python stdlib + Java SDK plugin |
> | Solibri integration | Shells out to Solibri CLI / minimal REST | **In-JVM HTTP server (port 10999) via custom SDK plugin** — fills the gaps the built-in REST API cannot |
> | Authoring | ❌ no ruleset / classification / presentation authoring | ✅ JSON ruleset install, bulk classification creation, BCF & per-slide viewpoint authoring, ITO, lifecycle (launch/shutdown) |
> | Discipline + spatial truth | ❌ | ✅ ARK-as-spatial-truth indexing across federation, discipline set via internal API |
> | Cross-session use | MCP over SSE | CLI (`cli.py …`) + Python `SuperuserClient` + same CLI works in any session |
> | Status | January 2026 spike; not actively used | Active development; this repo's MCP-style remote-access pattern can be reintroduced as a thin wrapper over the toolkit if needed |
>
> Open issues / PRs in this repo will not be addressed. Please file against the new toolkit.

---

# Solibri MCP Server (historical)

> The content below is preserved for historical reference. See deprecation notice above.

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
git clone https://github.com/EdvardGK/solibri-mcp-server.git
cd solibri-mcp-server
npm install
copy .env.example .env
# Edit .env with your settings
```

## Configuration

Edit `.env`:

```env
SOLIBRI_MCP_TOKEN=your-secure-token-here
SOLIBRI_EXE_PATH=C:\Program Files\Solibri\SOLIBRI\Solibri.exe
SOLIBRI_MCP_PORT=3000
```

## Running

```powershell
npm start
```

## Claude Code Configuration

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "solibri": {
      "type": "sse",
      "url": "http://YOUR_WINDOWS_IP:3000/sse",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

## License

MIT
