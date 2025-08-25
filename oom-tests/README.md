# ADaaS SDK OOM Testing Suite

This directory contains Out of Memory (OOM) testing for the ADaaS SDK to validate how the SDK behaves under memory pressure and when approaching memory limits.

## What These Tests Do

The OOM tests exercise the **actual ADaaS SDK functionality** under memory constraints to understand:

- How the SDK handles data extraction when memory is exhausted
- Whether the SDK properly emits error events when OOM occurs
- How HTTP requests and response caching behave under memory pressure
- The difference between timeout errors and OOM conditions

**Key Point**: These tests use real SDK workers, real event emission, and real HTTP requests - they're not generic memory allocation tests.

## Test Scenarios

### SDK Data Extraction Under Memory Pressure
- Tests the SDK's data extraction process with excessive memory consumption
- Uses real SDK repos, adapters, and event emission
- Validates that `EXTRACTION_DATA_ERROR` events are emitted on OOM

### SDK HTTP Extraction Under Memory Pressure  
- Tests HTTP-intensive extraction scenarios with memory leaks
- Simulates large response caching and request buffering
- Validates proper SDK error handling when memory is exhausted

### SDK Error Handling: Timeout vs OOM
- Compares SDK behavior between timeout and OOM scenarios
- Ensures the SDK can distinguish between different failure modes
- Validates appropriate event emission in each case

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Node.js 18+

### Running Tests

1. **Run all OOM tests (recommended):**
   ```bash
   npm run test:oom:docker
   ```

2. **Run locally (without Docker):**
   ```bash
   npm run test:oom
   ```

3. **Setup environment only:**
   ```bash
   npm run test:oom:setup
   ```

4. **Cleanup containers:**
   ```bash
   npm run test:oom:cleanup
   ```

## How It Works

The tests run in Docker containers with strict memory limits:
- **LocalStack**: 512MB limit (simulates AWS services)
- **Test Runner**: 384MB limit
- **Node.js Heap**: 256MB limit

When memory is exhausted, the SDK worker processes crash with OOM errors, and the SDK's error handling should emit appropriate error events.

## Files

```
oom-tests/
├── oom-scenarios.test.ts          # Main SDK OOM test scenarios
├── workers/
│   ├── oom-data-extraction.ts     # SDK data extraction worker (memory intensive)
│   └── oom-http-extraction.ts     # SDK HTTP extraction worker (memory intensive)
├── run-oom-tests.sh              # Test runner script with Docker monitoring
├── jest.config.oom.cjs           # Jest configuration for OOM tests
├── jest.setup.ts                 # Test setup with memory utilities
├── docker-compose.oom-tests.yml  # Docker orchestration with memory limits
├── Dockerfile.oom-tests          # Test runner container
└── README.md                     # This file
```

## Output

Test results and logs are stored in `./oom-test-logs/`:
- `test-output.log`: Complete test execution output
- `oom-test-report.md`: Test summary report
- `monitor.log`: Container monitoring data
- `docker-events.log`: Docker events timeline

## Expected Behavior

When tests run successfully, you should see:
1. SDK workers start processing data extraction
2. Memory usage grows rapidly as workers consume memory
3. Workers crash with "JavaScript heap out of memory" errors
4. SDK error handling kicks in and emits `EXTRACTION_DATA_ERROR` events
5. Tests validate that the proper error events were emitted

This confirms the SDK gracefully handles OOM conditions by emitting error events rather than crashing silently.

## Troubleshooting

- **"Missing script: test:oom"**: Run `npm install` to ensure scripts are available
- **Container OOM**: Increase memory limits in `docker-compose.oom-tests.yml`
- **LocalStack issues**: Check that ports 4566, 4510-4559 are available
- **Docker issues**: Ensure Docker daemon is running

