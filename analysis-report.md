# Incident Analysis Report: employee-service-srv

## Root Cause
A faulty `before('READ', Employees, ...)` handler in `srv/employee-service.js` was hardcoded to throw an IO_EXCEPTION on every GET /employee/Employees request, causing all such requests to fail with a 503 error.

## Log Evidence Summary
- Four ERROR log entries in the last 6 hours, all IOExceptions from `srv/employee-service.js:53`.
- All errors occurred during GET /employee/Employees, with the same error message: "connection reset by peer while streaming employee records".
- The error was not a real data source issue, but a hardcoded error in the handler.

## Metric Evidence Summary
- No usable memory metrics were available due to lack of Prometheus access.
- One WARN log indicated high memory usage (96.5%), but this was not directly related to the root cause of the incident.

## What Was Changed and Why
- The faulty `before('READ', Employees, ...)` handler was removed from `srv/employee-service.js`.
- This handler was responsible for blocking all read operations on Employees with a 503 error, regardless of actual data source health.
- Removing it restores normal GET /employee/Employees functionality.
