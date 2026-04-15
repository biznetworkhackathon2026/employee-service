# Automated Log Analysis Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions Workflow                   │
│                  (.github/workflows/analyze-logs.yml)        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Triggers:
                       │ • Manual (workflow_dispatch)
                       │ • Scheduled (cron: daily 2AM UTC)
                       │ • Webhook (repository_dispatch)
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            GitHub Copilot CLI Action (v1)                    │
│            austenstone/copilot-cli                           │
├──────────────────────────────────────────────────────────────┤
│  Config:                                                     │
│  • Model: Claude Sonnet 4                                    │
│  • Autopilot: Enabled (max 15 turns)                        │
│  • MCP: alertsMCP via SSE transport                         │
│  • Tools: GitHub MCP + alertsMCP tools                      │
│  • Reasoning: High effort                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Connects to MCP
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Remote alertsMCP Server                         │
│              (User-provided URL)                             │
├──────────────────────────────────────────────────────────────┤
│  Transport: SSE (Server-Sent Events)                         │
│  URL: ${{ vars.ALERTS_MCP_URL }}/sse                        │
│                                                              │
│  Available Tools:                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │ fetch_kibana_logs                                  │    │
│  │ - service_name: employee-service-srv               │    │
│  │ - log_level: ERROR                                 │    │
│  │ - time_window: -6h                                 │    │
│  │ - Returns: LogEntry[] with exceptions              │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ query_prometheus_metrics                           │    │
│  │ - metric_name: memory_usage_bytes                  │    │
│  │ - service_name: employee-service-srv               │    │
│  │ - Returns: MetricAnalysis with trend               │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Returns logs & metrics
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Claude AI Analysis Engine                   │
│                  (Embedded in Copilot CLI)                   │
├──────────────────────────────────────────────────────────────┤
│  1. Pattern Detection:                                       │
│     • Group exceptions by type                               │
│     • Extract stack traces                                   │
│     • Correlate with metrics                                 │
│                                                              │
│  2. Root Cause Analysis:                                     │
│     • OutOfMemoryError detected                             │
│     • Memory trend: increasing (500MB → 800MB)              │
│     • Location: srv/employee-service.js:56-96               │
│     • Issue: Unbounded searchCache Map                      │
│                                                              │
│  3. Fix Generation:                                          │
│     • Strategy: Implement LRU cache                          │
│     • Size limit: 1000 entries                              │
│     • TTL: 5 minutes                                         │
│     • Periodic cleanup                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Generates fix
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               GitHub API Operations                          │
│               (Via Copilot CLI)                              │
├──────────────────────────────────────────────────────────────┤
│  1. git checkout -b fix/employee-service-<timestamp>         │
│  2. Edit srv/employee-service.js:                            │
│     - Remove: const searchCache = new Map()                  │
│     - Add: LRU cache implementation                          │
│  3. git commit -m "fix: memory leak in search cache"         │
│  4. git push origin fix/employee-service-<timestamp>         │
│  5. Create Pull Request:                                     │
│     • Title: 🤖 Fix: Unbounded cache growth                 │
│     • Body: Analysis + metrics + diff                       │
│     • Labels: bug, auto-generated                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ PR created
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Pull Request #42                          │
│                                                              │
│  🤖 Fix: Unbounded cache growth in employee search          │
│                                                              │
│  ### Issue Detected                                          │
│  - Type: memory_leak                                         │
│  - Service: employee-service-srv                             │
│  - Errors: 127 OutOfMemoryError exceptions                   │
│  - Memory: 500MB → 800MB (increasing trend)                 │
│                                                              │
│  ### Root Cause                                              │
│  searchCache Map grows indefinitely without eviction         │
│                                                              │
│  ### Fix Applied                                             │
│  Implemented LRU cache with size limit and TTL               │
│                                                              │
│  Files changed: srv/employee-service.js                      │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Input                alertsMCP Response         AI Decision
    │                            │                        │
    ├─ service_name ────────────►│                        │
    ├─ time_window              │                        │
    ├─ create_pr                │                        │
    │                            │                        │
    │    Copilot CLI calls MCP   │                        │
    │    ┌──────────────────────►│                        │
    │    │ fetch_kibana_logs     │                        │
    │    │                       │                        │
    │    │       ◄────────────────┤                        │
    │    │       127 ERROR logs   │                        │
    │    │                       │                        │
    │    │ query_prometheus       │                        │
    │    │                       │                        │
    │    │       ◄────────────────┤                        │
    │    │       Metrics (↑ trend)│                        │
    │    └──────────────────────►│                        │
    │                            │                        │
    │         Claude analyzes    │                        │
    │         ┌──────────────────┴────────────────────┐   │
    │         │ Pattern: memory_leak                  │   │
    │         │ Location: srv/employee-service.js:56  │   │
    │         │ Solution: LRU cache                   │   │
    │         └──────────────────┬────────────────────┘   │
    │                            │                        │
    │         Apply fix via      │                        │
    │         GitHub MCP tools   │                        │
    │         ┌──────────────────▼────────────────────┐   │
    │         │ 1. Create branch                      │   │
    │         │ 2. Edit file                          │   │
    │         │ 3. Commit changes                     │   │
    │         │ 4. Push to remote                     │   │
    │         │ 5. Create PR                          │   │
    │         └───────────────────────────────────────┘   │
    │                                                      │
    ▼                                                      ▼
Output:                                            GitHub Repository:
• PR #42 created                                  • New branch created
• Analysis report (artifact)                      • PR awaiting review
• Workflow logs                                   • Code fix applied
```

## Configuration Files

```
employee-service/
├── .github/
│   ├── workflows/
│   │   └── analyze-logs.yml          # Main workflow definition
│   └── README.md                      # Detailed documentation
├── QUICKSTART.md                      # Setup guide
└── srv/
    └── employee-service.js            # File to be fixed
        └── lines 56-96: searchCache   # Memory leak location
```

## Security & Permissions

```
Repository Settings Required:
┌────────────────────────────────────────┐
│ Actions → General                      │
│ ├─ Workflow permissions: Read & write │
│ └─ ✓ Allow PR creation                │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ Secrets and variables → Variables      │
│ └─ ALERTS_MCP_URL=https://...         │
└────────────────────────────────────────┘

Organization Settings Required:
┌────────────────────────────────────────┐
│ Copilot → Policies                     │
│ └─ ✓ Allow Copilot CLI usage          │
└────────────────────────────────────────┘

Workflow Permissions:
┌────────────────────────────────────────┐
│ permissions:                           │
│   contents: write                      │
│   pull-requests: write                 │
│   issues: write                        │
│   copilot-requests: write              │
└────────────────────────────────────────┘
```

## Execution Timeline

```
Trigger → Setup → MCP Connect → Fetch Data → Analyze → Fix → PR
  ↓        ↓         ↓             ↓           ↓       ↓     ↓
  0s      10s       15s           30s         90s    150s  180s

Total Duration: ~3 minutes
```

## Integration Points

1. **GitHub Actions**: Workflow orchestration and scheduling
2. **Copilot CLI**: AI-powered automation engine
3. **MCP Protocol**: Standardized tool communication
4. **alertsMCP**: Log and metrics data source
5. **GitHub API**: Repository operations (branch, commit, PR)
6. **Claude AI**: Analysis and code generation
