# Incident Analysis Report

## Root Cause
The root cause was a hardcoded error in the `srv.before('READ', Employees, ...)` handler in `employee-service.js`. Every GET /employee/Employees request forcibly threw an `IO_EXCEPTION` ("connection reset by peer while streaming employee records"), causing all requests to fail with HTTP 503.

## Log Evidence Summary
- 4 ERROR log entries in the last 6 hours, all with `IO_EXCEPTION` from `srv/employee-service.js:53`.
- All errors occurred in the `before READ` handler for Employees.
- Service returned 503 for all GET /employee/Employees requests.
- High memory usage and slow query warnings were also present but not the direct cause of the outage.

## Metric Evidence Summary
- No metrics data was available due to an alert resolution failure (`Could not resolve alerts.api.github.com`).
- However, logs indicated high memory usage (up to 96.5% of 256MB limit) and slow queries, but these were not the root cause of the 503 errors.

## What Was Changed and Why
- The forced IO_EXCEPTION error and related alert/dispatch logic were removed from the `before READ` handler in `srv/employee-service.js`.
- The handler now only logs high memory usage if detected, but does not block or error the request.
- This restores normal GET /employee/Employees operation, resolving the service outage.

---

**Summary:**
The outage was caused by a deliberate error throw in the code, not by infrastructure or memory issues. The fix restores normal service operation.
