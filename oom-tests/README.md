# OOM (Out of Memory) Testing Suite

This directory contains a comprehensive testing suite designed to simulate and test Out of Memory (OOM) conditions using Docker containers with constrained memory and LocalStack for AWS service simulation.

## Overview

The OOM testing suite helps identify memory leaks, test memory pressure scenarios, and validate application behavior under memory constraints. It uses:

- **LocalStack**: AWS service emulation in a memory-constrained container
- **Docker Compose**: Orchestration with memory limits
- **Jest**: Testing framework with extended timeouts
- **Memory Monitoring**: Real-time memory usage tracking

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ 
- npm or yarn

### Running OOM Tests

1. **Run all tests with monitoring:**
   ```bash
   ./oom-tests/run-oom-tests.sh
   ```

2. **Cleanup only:**
   ```bash
   ./oom-tests/run-oom-tests.sh --cleanup-only
   ```

3. **Setup environment without running tests:**
   ```bash
   ./oom-tests/run-oom-tests.sh --skip-tests
   ```

4. **Run tests via npm:**
   ```bash
   npm run test:oom
   ```

## Test Scenarios

### 1. Memory Leak Scenarios

- **Gradual Array Growth**: Continuously append large objects to arrays
- **Rapid Memory Bursts**: Allocate large memory chunks rapidly  
- **Circular References**: Create objects with circular references preventing GC

### 2. LocalStack Integration Tests

- **Large File Uploads**: Upload large files to S3 until OOM
- **Concurrent Operations**: Multiple simultaneous AWS operations
- **Service Pressure**: Stress test multiple AWS services

### 3. Worker Thread Tests

- **Worker Memory Pressure**: Create memory pressure in worker threads
- **Multi-Worker Scenarios**: Test concurrent worker memory usage

## Architecture

```
oom-tests/
├── docker-compose.oom-tests.yml    # Docker orchestration with memory limits
├── Dockerfile.oom-tests            # Test runner container
├── run-oom-tests.sh               # Main test runner script
├── jest.config.oom.cjs            # Jest configuration for OOM tests
├── jest.setup.ts                  # Test setup and global utilities
├── types.ts                       # TypeScript interfaces
├── oom-test-helpers.ts            # Test utilities and runner
├── oom-scenarios.test.ts          # Main test scenarios
└── README.md                      # This file
```

## Memory Constraints

### Container Limits

- **LocalStack**: 512MB limit, 256MB reservation
- **Test Runner**: 384MB limit, 128MB reservation  
- **Node.js Heap**: 256MB (via NODE_OPTIONS)

### Monitoring

The test suite includes comprehensive monitoring:

- Real-time container memory usage
- Process memory tracking
- Docker events logging
- Memory snapshots during tests

## Configuration

### Environment Variables

- `LOCALSTACK_ENDPOINT`: LocalStack endpoint (default: http://localstack:4566)
- `AWS_ACCESS_KEY_ID`: AWS access key (default: test)
- `AWS_SECRET_ACCESS_KEY`: AWS secret key (default: test)
- `AWS_DEFAULT_REGION`: AWS region (default: us-east-1)
- `NODE_OPTIONS`: Node.js options (default: --max-old-space-size=256)

### Test Timeouts

- Individual test timeout: 2 minutes
- Scenario timeout: 1 minute (configurable)
- Global test suite timeout: Extended for OOM conditions

## Output and Reporting

### Log Files

All logs are stored in `./oom-test-logs/`:

- `test-output.log`: Complete test execution log
- `monitor.log`: Container monitoring output
- `docker-events.log`: Docker events during tests
- `final-stats.log`: Final container statistics
- `oom-test-report.md`: Generated test report

### Test Results

The test runner generates a comprehensive report including:

- Test execution summary
- Container statistics
- Memory usage patterns
- Error details and stack traces
- Docker events timeline

## Debugging OOM Issues

### Memory Monitoring

Use the global utilities available in tests:

```typescript
// Log current memory usage
global.logMemoryUsage('Before allocation');

// Force garbage collection
global.forceGC();
```

### Container Inspection

Monitor containers during test execution:

```bash
# Watch memory usage in real-time
docker stats adaas-localstack-oom adaas-oom-test-runner

# Check container logs
docker-compose -f docker-compose.oom-tests.yml logs -f oom-test-runner
```

### Memory Analysis

Enable garbage collection exposure for better debugging:

```bash
NODE_OPTIONS="--max-old-space-size=256 --expose-gc" npm run test:oom
```

## Best Practices

### Writing OOM Tests

1. **Start Small**: Begin with small memory allocations and gradually increase
2. **Monitor Continuously**: Use memory snapshots throughout tests
3. **Clean Up**: Always cleanup resources in test teardown
4. **Timeout Appropriately**: Set realistic timeouts for OOM conditions
5. **Isolate Tests**: Run memory-intensive tests sequentially

### Memory Management

1. **Force GC**: Use `global.forceGC()` between test scenarios
2. **Clear References**: Explicitly null large objects
3. **Monitor Patterns**: Watch for unexpected memory growth
4. **Validate Cleanup**: Ensure memory is released after tests

## Troubleshooting

### Common Issues

1. **Container OOM Kill**: Increase memory limits in docker-compose file
2. **LocalStack Startup**: Check health check and increase timeout
3. **Test Timeouts**: Adjust timeout values for slower systems
4. **Port Conflicts**: Ensure ports 4566, 4510-4559 are available

### Error Messages

- `ECONNREFUSED`: LocalStack not ready, wait longer or check health
- `JavaScript heap out of memory`: Increase Node.js heap size
- `Container killed`: Docker memory limit reached, increase limits

## Contributing

When adding new OOM test scenarios:

1. Follow existing patterns in `oom-scenarios.test.ts`
2. Use the `OOMTestRunner` for consistent monitoring
3. Add appropriate cleanup in test teardown
4. Document expected memory usage patterns
5. Update this README with new scenarios

## Security Notes

- Tests run in isolated Docker containers
- No real AWS credentials required (uses LocalStack)
- Memory constraints prevent system-wide impact
- Cleanup procedures remove all test artifacts

