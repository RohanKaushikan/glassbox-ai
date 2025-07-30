#!/usr/bin/env node

/**
 * Enterprise Reliability Features Demo
 * Demonstrates all 7 reliability features in action
 */

import { ReliabilityManager } from './src/reliability/reliability-manager.js';
import { ExponentialBackoff } from './src/reliability/exponential-backoff.js';
import { CircuitBreaker } from './src/reliability/circuit-breaker.js';
import { FallbackManager } from './src/reliability/fallback-manager.js';
import { HealthChecker } from './src/reliability/health-checker.js';
import { MetricsCollector } from './src/reliability/metrics-collector.js';
import { RequestQueue } from './src/reliability/request-queue.js';
import { GracefulShutdown } from './src/reliability/graceful-shutdown.js';

console.log('🚀 Enterprise Reliability Features Demo');
console.log('=' .repeat(60));

// 1. Exponential Backoff with Jitter Demo
console.log('\n1️⃣ Exponential Backoff with Jitter Demo');
console.log('-' .repeat(40));

const backoff = new ExponentialBackoff({
  baseDelay: 1000,
  maxDelay: 10000,
  maxAttempts: 3,
  jitterFactor: 0.1
});

let attemptCount = 0;
const failingService = async () => {
  attemptCount++;
  if (attemptCount < 3) {
    throw new Error('Service temporarily unavailable');
  }
  return 'Service recovered!';
};

try {
  const result = await backoff.execute(failingService, {
    onRetry: (error, attempt, delay) => {
      console.log(`  Retry attempt ${attempt}: ${error.message} (waiting ${delay}ms)`);
    }
  });
  console.log(`  ✅ Success: ${result}`);
} catch (error) {
  console.log(`  ❌ Failed: ${error.message}`);
}

// 2. Circuit Breaker Pattern Demo
console.log('\n2️⃣ Circuit Breaker Pattern Demo');
console.log('-' .repeat(40));

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 2,
  successThreshold: 1,
  timeout: 5000
});

let failureCount = 0;
const unreliableService = async () => {
  failureCount++;
  if (failureCount <= 3) {
    throw new Error('Service failure');
  }
  return 'Service working!';
};

for (let i = 0; i < 5; i++) {
  try {
    const result = await circuitBreaker.execute(unreliableService);
    console.log(`  ✅ Attempt ${i + 1}: ${result}`);
  } catch (error) {
    console.log(`  ❌ Attempt ${i + 1}: ${error.message}`);
  }
}

console.log(`  📊 Circuit State: ${circuitBreaker.getState().state}`);

// 3. Fallback Mechanisms Demo
console.log('\n3️⃣ Fallback Mechanisms Demo');
console.log('-' .repeat(40));

const fallbackManager = new FallbackManager();

// Register services with fallbacks
fallbackManager.registerService('primary', 
  async () => { throw new Error('Primary service failed'); },
  [
    async () => { throw new Error('Fallback 1 failed'); },
    async () => 'Fallback 2 succeeded!'
  ],
  { strategy: 'sequential' }
);

try {
  const result = await fallbackManager.execute('primary');
  console.log(`  ✅ Result: ${result.result}`);
  console.log(`  🔄 Service used: ${result.serviceUsed}`);
  console.log(`  🛡️  Fallback used: ${result.fallbackUsed}`);
} catch (error) {
  console.log(`  ❌ All services failed: ${error.message}`);
}

// 4. Health Checks & Monitoring Demo
console.log('\n4️⃣ Health Checks & Monitoring Demo');
console.log('-' .repeat(40));

const healthChecker = new HealthChecker({
  checkInterval: 5000,
  timeout: 3000
});

// Register health checks
healthChecker.registerCheck('healthy_service', async () => {
  return { status: 'healthy', responseTime: 100 };
}, { critical: false });

healthChecker.registerCheck('unhealthy_service', async () => {
  throw new Error('Service unhealthy');
}, { critical: true });

healthChecker.start();

// Wait for health checks to run
await new Promise(resolve => setTimeout(resolve, 6000));

const health = healthChecker.getOverallHealth();
console.log(`  📊 Overall Health: ${health.overall}`);
console.log(`  ✅ Healthy Services: ${health.healthy}`);
console.log(`  ❌ Unhealthy Services: ${health.unhealthy}`);

healthChecker.stop();

// 5. Request Queuing & Throttling Demo
console.log('\n5️⃣ Request Queuing & Throttling Demo');
console.log('-' .repeat(40));

const requestQueue = new RequestQueue({
  maxConcurrency: 2,
  maxQueueSize: 10,
  throttleRate: 5, // 5 requests per second
  timeout: 10000
});

const requests = [];
for (let i = 0; i < 5; i++) {
  requests.push(
    requestQueue.add(async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return `Request ${i + 1} completed`;
    }, { priority: i % 2 })
  );
}

try {
  const results = await Promise.all(requests);
  console.log(`  ✅ Completed ${results.length} requests`);
  console.log(`  📊 Queue Status: ${JSON.stringify(requestQueue.getStatus())}`);
} catch (error) {
  console.log(`  ❌ Queue error: ${error.message}`);
}

// 6. Detailed Metrics & Observability Demo
console.log('\n6️⃣ Detailed Metrics & Observability Demo');
console.log('-' .repeat(40));

const metrics = new MetricsCollector({
  enabled: true,
  exportInterval: 10000
});

// Record various metrics
metrics.increment('requests_total', 1, { service: 'demo' });
metrics.increment('requests_total', 1, { service: 'demo' });
metrics.gauge('active_connections', 5, { service: 'demo' });
metrics.histogram('response_time', 150, { service: 'demo' });
metrics.histogram('response_time', 200, { service: 'demo' });
metrics.histogram('response_time', 100, { service: 'demo' });

// Record events
metrics.event('user_action', { action: 'test_reliability', user: 'demo' });

const allMetrics = metrics.getAllMetrics();
console.log(`  📊 Total Counters: ${allMetrics.summary.totalCounters}`);
console.log(`  📊 Total Histograms: ${allMetrics.summary.totalHistograms}`);
console.log(`  📊 Total Events: ${allMetrics.summary.totalEvents}`);

const performanceMetrics = metrics.getPerformanceMetrics();
console.log(`  ⚡ Performance Metrics: ${JSON.stringify(performanceMetrics)}`);

// 7. Graceful Shutdown Demo
console.log('\n7️⃣ Graceful Shutdown Demo');
console.log('-' .repeat(40));

const gracefulShutdown = new GracefulShutdown({
  shutdownTimeout: 10000,
  forceKillTimeout: 2000
});

// Register cleanup tasks
gracefulShutdown.registerCleanupTask('cleanup_demo', async () => {
  console.log('  🧹 Cleaning up demo resources...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('  ✅ Demo cleanup completed');
}, { priority: 1, critical: false });

gracefulShutdown.registerCleanupTask('save_metrics', async () => {
  console.log('  💾 Saving final metrics...');
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('  ✅ Metrics saved');
}, { priority: 2, critical: false });

// Register shutdown hooks
gracefulShutdown.registerShutdownHook(async () => {
  console.log('  📝 Generating shutdown report...');
  return 'Shutdown report generated';
}, { priority: 1 });

console.log('  🔧 Shutdown system configured');
console.log(`  📊 Registered tasks: ${gracefulShutdown.getStatus().cleanupTasksCount}`);
console.log(`  📊 Registered hooks: ${gracefulShutdown.getStatus().shutdownHooksCount}`);

// 8. Integrated Reliability Manager Demo
console.log('\n8️⃣ Integrated Reliability Manager Demo');
console.log('-' .repeat(40));

const reliabilityManager = new ReliabilityManager({
  enabled: true,
  autoStart: true,
  backoff: { maxAttempts: 2 },
  circuitBreaker: { failureThreshold: 2 },
  health: { checkInterval: 10000 },
  queue: { maxConcurrency: 3 },
  metrics: { enabled: true },
  shutdown: { shutdownTimeout: 5000 }
});

// Register a demo service
reliabilityManager.registerService('demo_service', 
  async (input) => {
    if (input === 'fail') {
      throw new Error('Service failure');
    }
    return `Processed: ${input}`;
  },
  [
    async (input) => `Fallback processed: ${input}`
  ],
  {
    circuitBreaker: { failureThreshold: 1 },
    health: { critical: false },
    queue: { priority: 1 }
  }
);

// Test the service
try {
  const result1 = await reliabilityManager.executeWithReliability('demo_service', ['success']);
  console.log(`  ✅ Success test: ${result1}`);
  
  const result2 = await reliabilityManager.executeWithReliability('demo_service', ['fail']);
  console.log(`  ✅ Failure test: ${result2}`);
} catch (error) {
  console.log(`  ❌ Service error: ${error.message}`);
}

// Get system health
const systemHealth = reliabilityManager.getSystemHealth();
console.log(`  📊 System Health: ${systemHealth.overall.overall}`);
console.log(`  🔧 Services: ${systemHealth.services.length}`);

// Get system metrics
const systemMetrics = reliabilityManager.getSystemMetrics();
console.log(`  📈 Metrics Summary: ${JSON.stringify(systemMetrics.metrics.summary)}`);

// Cleanup
reliabilityManager.stop();

console.log('\n🎯 Enterprise Reliability Demo Complete!');
console.log('=' .repeat(60));
console.log('✅ All 7 reliability features demonstrated:');
console.log('   • Exponential backoff with jitter');
console.log('   • Circuit breaker pattern');
console.log('   • Fallback mechanisms');
console.log('   • Health checks and monitoring');
console.log('   • Request queuing and throttling');
console.log('   • Detailed metrics and observability');
console.log('   • Graceful shutdown procedures');
console.log('\n🚀 Your AI testing infrastructure is now enterprise-ready!'); 