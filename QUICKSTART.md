# Quick Start: Debug Analyzer Action

Get the automated log analysis and fix generation running in 5 minutes!

## Prerequisites

- [ ] Your alertsMCP server is deployed and accessible via HTTPS
- [ ] You have admin access to this GitHub repository
- [ ] Your GitHub organization has Copilot enabled

## Step 1: Configure Repository Variable

Add the alertsMCP server URL:

```bash
# Via GitHub CLI
gh variable set ALERTS_MCP_URL --body "https://your-alerts-mcp-server.com"

# Or via web UI:
# 1. Go to Settings → Secrets and variables → Actions → Variables
# 2. Click "New repository variable"
# 3. Name: ALERTS_MCP_URL
# 4. Value: https://your-alerts-mcp-server.com
```

## Step 2: Enable Organization Copilot Policy

1. Go to your GitHub organization settings
2. Navigate to Copilot → Policies
3. Enable: "Allow use of Copilot CLI billed to the organization"

## Step 3: Set Repository Permissions

```bash
# Via GitHub CLI
gh api repos/:owner/:repo -X PATCH -f allow_actions=true

# Or via web UI:
# 1. Settings → Actions → General
# 2. Workflow permissions → "Read and write permissions"
# 3. ✓ "Allow GitHub Actions to create and approve pull requests"
```

## Step 4: Test the Workflow

### Option A: Via GitHub Actions UI

1. Go to the **Actions** tab
2. Select **"Analyze Production Logs with MCP"**
3. Click **"Run workflow"**
4. Select:
   - Service: `employee-service-srv`
   - Time window: `-6h`
   - Create PR: `true`
5. Click **"Run workflow"**

### Option B: Via GitHub CLI

```bash
gh workflow run analyze-logs.yml \
  -f service_name=employee-service-srv \
  -f time_window=-6h \
  -f create_pr=true
```

## Step 5: Monitor Execution

Watch the workflow in real-time:

```bash
# List recent runs
gh run list --workflow=analyze-logs.yml

# Watch a specific run
gh run watch <run-id>

# View logs
gh run view <run-id> --log
```

Expected output:
```
✅ Checkout repository
🤖 Analyze logs and generate fix using Copilot CLI + MCP
   ├── Connecting to alertsMCP at https://...
   ├── Fetching logs for employee-service-srv
   ├── Found 127 ERROR logs with OutOfMemoryError
   ├── Analyzing memory metrics (trend: increasing)
   ├── Root cause: Unbounded cache in srv/employee-service.js
   ├── Generating LRU cache fix
   ├── Creating branch: fix/employee-service-<timestamp>
   └── ✅ PR created: #42
📤 Upload analysis report
```

## Step 6: Review the Pull Request

The action will create a PR with:
- **Title**: 🤖 Fix: Unbounded cache growth in employee search
- **Body**: Detailed analysis including:
  - Error count and time window
  - Memory metrics (500MB → 800MB trend)
  - Root cause explanation
  - Stack trace references
  - Code diff with LRU cache implementation

## Step 7: (Optional) Schedule Automatic Runs

The workflow is already configured to run daily at 2 AM UTC. To change the schedule:

```yaml
# Edit .github/workflows/analyze-logs.yml
schedule:
  - cron: '0 14 * * *'  # Run at 2 PM UTC instead
```

## Verification Checklist

- [ ] Repository variable `ALERTS_MCP_URL` is set
- [ ] Organization Copilot policy is enabled
- [ ] Workflow permissions include write access
- [ ] Workflow runs without errors
- [ ] MCP connection succeeds
- [ ] Logs are fetched successfully
- [ ] PR is created with fix

## Troubleshooting

### "MCP server connection failed"

```bash
# Test the MCP server endpoint directly
curl https://your-alerts-mcp-server.com/sse

# Expected: SSE connection or MCP handshake response
```

**Fix**: Verify the URL is correct and the server is running

### "Copilot requests unauthorized"

Check organization policy:
```bash
gh api orgs/:org/copilot/settings | jq '.policies'
```

**Fix**: Enable "Allow use of Copilot CLI billed to the organization"

### "Permission denied to create PR"

Check workflow permissions:
```bash
gh api repos/:owner/:repo | jq '.permissions'
```

**Fix**: Enable write permissions in repository settings

## Next Steps

- **Customize the analysis prompt** in the workflow file
- **Add more services** to the service_name dropdown
- **Integrate with Slack** for notifications
- **Set up webhooks** for alert-driven triggers

## Support

- View workflow runs: `gh run list --workflow=analyze-logs.yml`
- Download artifacts: `gh run download <run-id>`
- View logs: `gh run view <run-id> --log`

---

For detailed documentation, see [.github/README.md](.github/README.md)
