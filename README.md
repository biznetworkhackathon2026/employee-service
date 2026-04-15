# Employee Service

CAP CDS Node.js microservice for Employee Management, deployable to SAP BTP Cloud Foundry.

## 🤖 Automated Debugging

This repository includes **automated log analysis and code fix generation** using GitHub Actions + GitHub Copilot CLI + MCP.

**Quick Start**: See [QUICKSTART.md](QUICKSTART.md) for 5-minute setup  
**How it works**: See [ARCHITECTURE.md](ARCHITECTURE.md) for system diagrams  
**Example output**: See [EXAMPLE_OUTPUT.md](EXAMPLE_OUTPUT.md) for sample PR

### What It Does

When you trigger the "Analyze Production Logs" workflow:
1. 🔍 Connects to alertsMCP server to fetch logs and metrics
2. 🧠 Analyzes errors using Claude Sonnet 4 AI
3. 🔧 Identifies root causes (e.g., memory leaks)
4. 📝 Generates code fixes
5. 🚀 Creates pull request with detailed analysis

**Trigger**: Manual, scheduled (daily 2 AM), or webhook  
**Duration**: ~3 minutes  
**Output**: PR with fix + analysis report

## Features
- CRUD OData V4 API for Employees
- Custom `onboardEmployee` action with Alert Notification
- XSUAA security (dummy in dev)
- HANA HDI in production, SQLite in development

## Local Development

```bash
npm install
cds watch        # starts server with hot reload on http://localhost:4004
```

Service explorer: http://localhost:4004

## Build & Deploy to BTP CF

```bash
# 1. Login
cf login -a api.cf.us10.hana.ondemand.com -o b0362cb0trial -s dev

# 2. Build MTA
mbt build -p=cf

# 3. Deploy
cf deploy mta_archives/employee-service_1.0.0.mtar

# 4. Bind alert-notification (if not bound via mta.yaml)
cf bind-service employee-service-srv alert-notification
cf restage employee-service-srv
```

## OData Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET    | /employee/Employees | List all employees |
| GET    | /employee/Employees('ID') | Get employee by ID |
| POST   | /employee/Employees | Create employee |
| PATCH  | /employee/Employees('ID') | Update employee |
| DELETE | /employee/Employees('ID') | Delete employee |
| POST   | /employee/onboardEmployee | Onboard action (with notification) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT`   | Server port (default 4004) |

## Alert Notification Events

- `New Employee Onboarded` — fires on `onboardEmployee` action
- `Employee Offboarded` — fires on DELETE
- `Employee Status Changed` — fires when status set to Inactive
