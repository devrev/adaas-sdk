#!/bin/bash

# OOM Test Runner Script
# This script runs OOM tests inside Docker containers with memory constraints

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="oom-tests/docker-compose.oom-tests.yml"
PROJECT_NAME="adaas-oom-tests"
LOG_DIR="./oom-test-logs"
REPORT_FILE="$LOG_DIR/oom-test-report.md"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

cleanup() {
    log_info "Cleaning up containers and networks..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down --volumes --remove-orphans 2>/dev/null || true
    docker system prune -f --volumes 2>/dev/null || true
}

setup_logging() {
    mkdir -p "$LOG_DIR"
    echo "# OOM Test Run - $(date)" > "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Docker Compose file '$COMPOSE_FILE' not found"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

monitor_containers() {
    log_info "Starting container monitoring..."
    
    # Start monitoring in background
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f oom-monitor > "$LOG_DIR/monitor.log" 2>&1 &
    MONITOR_PID=$!
    
    # Monitor Docker events
    docker events --filter container=adaas-localstack-oom --filter container=adaas-oom-test-runner \
        --format "{{.Time}} {{.Container}} {{.Status}} {{.Action}}" > "$LOG_DIR/docker-events.log" 2>&1 &
    EVENTS_PID=$!
    
    echo "Monitor PID: $MONITOR_PID, Events PID: $EVENTS_PID"
}

run_oom_tests() {
    log_info "Starting OOM tests..."
    
    # Build and start services
    log_info "Building test runner image..."
    if ! docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" build oom-test-runner; then
        log_error "Failed to build test runner image"
        return 1
    fi
    
    log_info "Starting LocalStack..."
    if ! docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d localstack; then
        log_error "Failed to start LocalStack"
        return 1
    fi
    
    # Wait for LocalStack to be healthy
    log_info "Waiting for LocalStack to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps localstack | grep -q "healthy"; then
            log_success "LocalStack is ready"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            log_error "LocalStack failed to start within timeout"
            docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs localstack
            exit 1
        fi
        
        log_info "Attempt $attempt/$max_attempts - waiting for LocalStack..."
        sleep 5
        ((attempt++))
    done
    
    # Start monitoring
    log_info "Starting monitoring services..."
    if ! docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d oom-monitor; then
        log_error "Failed to start monitoring services"
        return 1
    fi
    monitor_containers
    
    # Run the actual tests
    log_info "Running OOM test scenarios..."
    set +e  # Don't exit on test failures
    
    # Use PIPESTATUS to capture the exit code of docker-compose, not tee
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" run --rm oom-test-runner 2>&1 | tee "$LOG_DIR/test-output.log"
    TEST_EXIT_CODE=${PIPESTATUS[0]}
    
    set -e
    
    # Capture final container stats
    log_info "Capturing final container statistics..."
    docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.CPUPerc}}" \
        adaas-localstack-oom adaas-oom-test-runner > "$LOG_DIR/final-stats.log" 2>/dev/null || true
    
    return $TEST_EXIT_CODE
}

generate_report() {
    local test_exit_code=$1
    
    log_info "Generating test report..."
    
    {
        echo "## Test Execution Summary"
        echo ""
        echo "- **Date**: $(date)"
        echo "- **Exit Code**: $test_exit_code"
        echo "- **Status**: $([ $test_exit_code -eq 0 ] && echo "✅ SUCCESS" || echo "❌ FAILED")"
        echo ""
        
        echo "## Container Statistics"
        echo ""
        echo "\`\`\`"
        cat "$LOG_DIR/final-stats.log" 2>/dev/null || echo "No statistics available"
        echo "\`\`\`"
        echo ""
        
        echo "## Docker Events"
        echo ""
        echo "\`\`\`"
        tail -20 "$LOG_DIR/docker-events.log" 2>/dev/null || echo "No events logged"
        echo "\`\`\`"
        echo ""
        
        echo "## Test Output (Last 50 lines)"
        echo ""
        echo "\`\`\`"
        tail -50 "$LOG_DIR/test-output.log" 2>/dev/null || echo "No test output available"
        echo "\`\`\`"
        echo ""
        
    } >> "$REPORT_FILE"
    
    log_success "Report generated: $REPORT_FILE"
}

main() {
    echo "========================================"
    echo "   ADaaS SDK OOM Test Runner"
    echo "========================================"
    echo ""
    
    # Parse command line arguments
    local cleanup_only=false
    local skip_tests=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --cleanup-only)
                cleanup_only=true
                shift
                ;;
            --skip-tests)
                skip_tests=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --cleanup-only    Only cleanup containers and exit"
                echo "  --skip-tests      Setup environment but don't run tests"
                echo "  -h, --help        Show this help message"
                echo ""
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Cleanup first
    cleanup
    
    if [ "$cleanup_only" = true ]; then
        log_success "Cleanup completed"
        exit 0
    fi
    
    # Setup
    trap cleanup EXIT
    check_prerequisites
    setup_logging
    
    if [ "$skip_tests" = false ]; then
        # Run tests
        local test_result=0
        run_oom_tests || test_result=$?
        
        # Stop monitoring processes
        if [ -n "$MONITOR_PID" ]; then
            kill $MONITOR_PID 2>/dev/null || true
        fi
        if [ -n "$EVENTS_PID" ]; then
            kill $EVENTS_PID 2>/dev/null || true
        fi
        
        # Generate report
        generate_report $test_result
        
        if [ $test_result -eq 0 ]; then
            log_success "All OOM tests completed successfully!"
        else
            log_error "OOM tests failed or encountered issues (exit code: $test_result)"
        fi
        
        exit $test_result
    else
        log_info "Environment setup completed. Skipping tests as requested."
        log_info "You can now run tests manually with:"
        log_info "docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME run --rm oom-test-runner"
    fi
}

# Run main function with all arguments
main "$@"

