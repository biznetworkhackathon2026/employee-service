# Incident Analysis Report: employee-service-srv

## Root Cause
The root cause was an unbounded in-memory cache (`searchCache` Map) in `employee-service.js`, which grew to 15.2 GB and caused repeated JavaScript heap out-of-memory errors. This led to service instability and failures on the GET /employee/Employees endpoint.

## Log Evidence Summary
- Multiple `FATAL ERROR: JavaScript heap out of memory` errors referencing `searchCache Map has grown to 15.2 GB with 8472 cached search queries (employee-service.js:56)`.
- Service errors and unavailability on GET /employee/Employees.

## Metric Evidence Summary
- Memory usage showed a steady, unbroken increase over time, peaking at nearly 16 GB, with no sign of release or garbage collection.

## What Was Changed and Why
- Removed the `searchCache` Map and `memoryBlackHole` array from `employee-service.js`.
- This eliminates the unbounded memory growth and resolves the memory leak, preventing future heap exhaustion and service outages.
