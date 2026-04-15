# Debug Analyzer GitHub Action

This repository uses GitHub Copilot CLI with MCP (Model Context Protocol) to automatically analyze production logs and generate code fixes.

## How It Works

1. **Trigger**: Run manually via Actions UI, scheduled daily at 2 AM UTC, or via webhook
2. **MCP Integration**: Connects to remote alertsMCP server to fetch logs and metrics
3. **AI Analysis**: Copilot CLI analyzes logs using Claude Sonnet 4 to identify issues
4. **Auto-Fix**: Creates a pull request with code fixes for detected problems

## Setup

### 1. Configure MCP Server URL

Add the alertsMCP server URL as a repository variable:
- Go to Settings → Secrets and variables → Actions → Variables
- Click "New repository variable"
- Name: `ALERTS_MCP_URL`
- Value: Your alertsMCP server URL (e.g., `https://alerts-mcp.example.com`)

### 2. Enable Copilot Organization Policy

Your GitHub organization must enable:
- Settings → Copilot → Policies
- ✓ "Allow use of Copilot CLI billed to the organization"

### 3. Repository Permissions

Ensure the workflow has permissions:
- Settings → Actions → General → Workflow permissions
- Select "Read and write permissions"
- ✓ "Allow GitHub Actions to create and approve pull requests"

## Usage

### Manual Trigger

1. Go to Actions tab
2. Select "Analyze Production Logs with MCP"
3. Click "Run workflow"
4. Select service name and time window
5. Click "Run workflow"

### Via GitHub CLI

```bash
gh workflow run analyze-logs.yml \
  -f service_name=employee-service-srv \
  -f time_window=-6h \
  -f create_pr=true
```

### Via API/Webhook

```bash
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/OWNER/REPO/dispatches \
  -d '{"event_type":"analyze-alert","client_payload":{"service":"employee-service-srv"}}'
```

## What Gets Analyzed

The action uses the alertsMCP server to:
- Fetch ERROR level logs from the specified service
- Query memory usage metrics to detect trends
- Analyze stack traces for root causes
- Detect memory leaks, exceptions, and performance issues

## Example: Memory Leak Detection

For the employee-service memory leak bug:
- **Issue**: Unbounded `searchCache` Map in `srv/employee-service.js:56-96`
- **Detection**: OutOfMemoryError logs + increasing memory_usage_bytes metric
- **Fix**: Implements LRU cache with size limit and TTL
- **Output**: Pull request with detailed analysis and code changes

## Outputs

- **PR**: Created automatically with fix and analysis
- **Artifact**: `copilot-analysis.md` with full session details
- **Logs**: Available in Actions run logs

## MCP Configuration

The workflow connects to alertsMCP via SSE transport:

```json
{
  "mcpServers": {
    "alerts": {
      "transport": {
        "type": "sse",
        "url": "https://your-alerts-mcp-url/sse"
      }
    }
  }
}
```

Available MCP tools:
- `fetch_kibana_logs` - Retrieve application logs
- `query_prometheus_metrics` - Query time-series metrics

## Customization

Edit `.github/workflows/analyze-logs.yml` to:
- Change schedule (cron expression)
- Adjust max-turns for longer/shorter analysis
- Modify model or reasoning-effort
- Add additional services to analyze
- Configure different MCP servers

## Troubleshooting

**Action fails with "MCP connection error":**
- Verify `ALERTS_MCP_URL` is set correctly in repository variables
- Check that the alertsMCP server is running and accessible
- Ensure the URL includes the protocol (https://)

**No PR created:**
- Check if `create_pr` input is set to `true`
- Verify repository permissions allow PR creation
- Review action logs for analysis results

**Copilot CLI not authorized:**
- Ensure organization Copilot policy is enabled
- Verify workflow has `copilot-requests: write` permission
