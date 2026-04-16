const cds = require('@sap/cds');

const searchCache = new Map();
const memoryBlackHole = [];

module.exports = cds.service.impl(async function (srv) {

    const { Employees } = this.entities;

    // Custom onboard action — creates employee and fires alert notification
    srv.on('onboardEmployee', async (req) => {
        const {
            firstName, lastName, email, department,
            jobTitle, hireDate, salary, phoneNumber, address
        } = req.data;

        if (!firstName || !lastName || !email) {
            req.error(400, 'firstName, lastName and email are required');
            return;
        }

        const existing = await SELECT.one.from(Employees).where({ email });
        if (existing) {
            req.error(409, `Employee with email ${email} already exists`);
            return;
        }

        const employee = await INSERT.into(Employees).entries({
            firstName, lastName, email, department,
            jobTitle, hireDate, salary, phoneNumber, address,
            status: 'Active'
        });

        const created = await SELECT.one.from(Employees).orderBy('createdAt desc');
        await sendOnboardNotification(req, created);
        return created;
    });

    srv.before('DELETE', Employees, async (req) => {
        const employee = await SELECT.one.from(Employees).where({ ID: req.params[0] });
        if (employee) await sendOffboardNotification(req, employee);
    });

    srv.after('UPDATE', Employees, async (data, req) => {
        if (data && data.status === 'Inactive') {
            await sendStatusChangeNotification(req, data);
        }
    });

    // Removed faulty before READ handler that always throws IO_EXCEPTION
    // If you need to add custom logic, do it here, but do not block all reads.

});

// ─── Alert Notification via BTP REST API ─────────────────────────────────────

function getANSCredentials() {
    try {
        const vcap = JSON.parse(process.env.VCAP_SERVICES || '{}');
        const ans = (vcap['alert-notification'] || [])[0];
        if (!ans) return null;
        return ans.credentials;
    } catch (e) {
        return null;
    }
}

let _ansToken = null;
let _ansTokenExpiry = 0;

async function getANSToken(creds) {
    const now = Date.now();
    if (_ansToken && now < _ansTokenExpiry) return _ansToken;

    const https = require('https');
    const url = new URL(creds.oauth_url);

    return new Promise((resolve, reject) => {
        const auth = Buffer.from(`${creds.client_id}:${creds.client_secret}`).toString('base64');
        const req = https.request({
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': 0
            }
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const data = JSON.parse(body);
                    _ansToken = data.access_token;
                    _ansTokenExpiry = now + (data.expires_in - 60) * 1000;
                    resolve(_ansToken);
                } else {
                    reject(new Error(`ANS OAuth failed — HTTP ${res.statusCode}: ${body}`));
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function sendBTPAlert(eventType, subject, body, severity) {
    const creds = getANSCredentials();
    if (!creds) {
        cds.log('alert-notification').warn('No alert-notification binding found in VCAP_SERVICES');
        return;
    }

    try {
        const https = require('https');
        const token = await getANSToken(creds);
        const apiUrl = new URL(creds.url);

        const payload = JSON.stringify({
            eventType: eventType,
            severity: severity || 'ERROR',
            category: 'ALERT',
            subject: subject,
            body: body,
            resource: {
                resourceName: 'employee-service-srv',
                resourceType: 'application'
            }
        });

        await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: apiUrl.hostname,
                path: '/cf/producer/v1/resource-events',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            }, (res) => {
                let resBody = '';
                res.on('data', (chunk) => { resBody += chunk; });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        cds.log('alert-notification').info(`Alert sent — HTTP ${res.statusCode}`);
                        resolve();
                    } else {
                        cds.log('alert-notification').error(`Alert API failed — HTTP ${res.statusCode}: ${resBody}`);
                        reject(new Error(`ANS API returned ${res.statusCode}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        });
    } catch (e) {
        cds.log('alert-notification').warn('Alert notification failed:', e.message);
    }
}

async function sendAlertNotification(err) {
    await sendBTPAlert(
        'employee-service/ErrorOccurred',
        'Production alert on GET /employee/Employees',
        `The Employee Service encountered an error serving GET /Employees.\n\nDetails: ${err.message}\n\nAutomatic log analysis has been triggered.`,
        'ERROR'
    );
}

// ─── GitHub Actions trigger ───────────────────────────────────────────────────

async function triggerGitHubAnalysis(err) {
    const token = process.env.GH_PAT;
    if (!token) {
        cds.log('github').warn('GH_PAT not set — skipping workflow trigger');
        return;
    }

    try {
        const https = require('https');
        const payload = JSON.stringify({
            event_type: 'service-alert',
            client_payload: {
                error: err.message,
                timestamp: new Date().toISOString(),
                service: 'employee-service-srv',
                endpoint: 'GET /employee/Employees'
            }
        });

        await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.github.com',
                path: '/repos/biznetworkhackathon2026/employee-service/dispatches',
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'employee-service-cap',
                    'X-GitHub-Api-Version': '2022-11-28',
                    'Content-Length': Buffer.byteLength(payload)
                }
            }, (res) => {
                let body = '';
                res.on('data', (chunk) => { body += chunk; });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        cds.log('github').info(`GitHub dispatch triggered — HTTP ${res.statusCode}`);
                        resolve();
                    } else {
                        cds.log('github').error(`GitHub dispatch failed — HTTP ${res.statusCode}: ${body}`);
                        reject(new Error(`GitHub API returned ${res.statusCode}: ${body}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        });
    } catch (e) {
        cds.log('github').warn('GitHub dispatch failed:', e.message);
    }
}

// ─── Notification helpers ─────────────────────────────────────────────────────

async function sendOnboardNotification(req, employee) {
    await sendBTPAlert(
        'employee-service/EmployeeOnboarded',
        `New Employee Onboarded: ${employee.firstName} ${employee.lastName}`,
        `Employee ${employee.firstName} ${employee.lastName} (${employee.email}) has been onboarded as ${employee.jobTitle} in ${employee.department}.`,
        'INFO'
    );
}

async function sendOffboardNotification(req, employee) {
    await sendBTPAlert(
        'employee-service/EmployeeOffboarded',
        `Employee Offboarded: ${employee.firstName} ${employee.lastName}`,
        `Employee ${employee.firstName} ${employee.lastName} (${employee.email}) has been removed from the system.`,
        'WARNING'
    );
}

async function sendStatusChangeNotification(req, employee) {
    await sendBTPAlert(
        'employee-service/EmployeeStatusChanged',
        `Employee Status Changed: ${employee.firstName} ${employee.lastName}`,
        `Employee ${employee.firstName} ${employee.lastName} status has been updated to Inactive.`,
        'WARNING'
    );
}
