# Incident Analysis Report: employee-service-srv

## Root Cause
A memory leak was caused by an ever-growing `searchCache` Map in `employee-service.js`. This cache was not used anywhere in the code but was accumulating entries, leading to JavaScript heap out-of-memory errors.

## Log Evidence Summary
- Multiple `FATAL ERROR: JavaScript heap out of memory - searchCache Map has grown to 15.2 GB with 8472 cached search queries` errors in logs.
- Errors reference `employee-service.js:56` and similar lines, confirming the source.

## Metric Evidence Summary
- Memory usage (`memory_usage_bytes`) showed a steady, unbroken increase over the observed window, with no drops, indicating a memory leak.
- No anomaly detected, but the trend was consistently upward, peaking at nearly 800MB.

## What Was Changed and Why
- The unused `searchCache` Map declaration was removed (commented out) from `employee-service.js`.
- This prevents the memory leak and out-of-memory crashes, as the cache was not being used or cleared anywhere in the code.
