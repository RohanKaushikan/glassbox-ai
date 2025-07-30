#!/usr/bin/env node

import { CacheManager } from './src/cache/cache-manager.js';
import { createCachedClient } from './src/cache/cache-integration.js';
import { CacheConfig } from './src/cache/cache-config.js';

/**
 * Simple test script to verify caching system
 */
async function testCache() {
  console.log('🧪 Testing Glassbox Caching System...\n');

  try {
    // Test 1: Cache Manager
    console.log('1. Testing Cache Manager...');
    const cacheManager = new CacheManager({
      cacheDir: './test-cache',
      defaultTTL: 60000, // 1 minute for testing
      maxCacheSize: 10 * 1024 * 1024 // 10MB
    });
    
    await cacheManager.initialize();
    console.log('✅ Cache Manager initialized');

    // Test 2: Basic cache operations
    console.log('\n2. Testing basic cache operations...');
    
    const testPrompt = 'What is 2 + 2?';
    const testModel = 'gpt-3.5-turbo';
    const testResponse = { content: '2 + 2 equals 4' };
    
    // Set cache entry
    const key = await cacheManager.set(testPrompt, testModel, testResponse);
    console.log('✅ Cache entry set:', key.substring(0, 16) + '...');
    
    // Get cache entry
    const retrieved = await cacheManager.get(testPrompt, testModel);
    if (retrieved && retrieved.response.content === testResponse.content) {
      console.log('✅ Cache entry retrieved successfully');
    } else {
      console.log('❌ Cache retrieval failed');
    }
    
    // Test 3: Cache statistics
    console.log('\n3. Testing cache statistics...');
    const stats = cacheManager.getStats();
    console.log('✅ Cache stats:', {
      hits: stats.hits,
      misses: stats.misses,
      writes: stats.writes,
      entryCount: stats.entryCount,
      cacheSize: stats.cacheSize
    });
    
    // Test 4: Cache integration with AI client
    console.log('\n4. Testing cache integration...');
    
    const mockAIClient = {
      sendRequest: async (request) => {
        // Simulate AI response
        return {
          content: `Response to: ${request.prompt}`,
          usage: { total_tokens: 10 }
        };
      },
      defaultModel: 'test-model'
    };
    
    const cachedClient = createCachedClient(mockAIClient, {
      cacheDir: './test-cache',
      defaultTTL: 60000
    });
    
    // First request (should miss cache)
    const response1 = await cachedClient.sendRequest({
      prompt: 'Test prompt 1',
      model: 'test-model'
    });
    console.log('✅ First request completed, cached:', response1.cached);
    
    // Second request (should hit cache)
    const response2 = await cachedClient.sendRequest({
      prompt: 'Test prompt 1',
      model: 'test-model'
    });
    console.log('✅ Second request completed, cached:', response2.cached);
    
    // Test 5: Cache configuration
    console.log('\n5. Testing cache configuration...');
    const config = new CacheConfig('./test-cache-config.json');
    await config.load();
    
    console.log('✅ Cache config loaded:', {
      enabled: config.isEnabled(),
      defaultTTL: config.get('defaultTTL'),
      maxCacheSize: config.get('maxCacheSize')
    });
    
    // Test 6: Cache cleanup
    console.log('\n6. Testing cache cleanup...');
    await cacheManager.cleanup();
    console.log('✅ Cache cleanup completed');
    
    // Test 7: List entries
    console.log('\n7. Testing cache listing...');
    const entries = await cacheManager.listEntries();
    console.log('✅ Cache entries listed:', entries.length, 'entries');
    
    // Test 8: Cache invalidation
    console.log('\n8. Testing cache invalidation...');
    await cacheManager.invalidate(key);
    const afterInvalidation = await cacheManager.get(testPrompt, testModel);
    if (!afterInvalidation) {
      console.log('✅ Cache invalidation successful');
    } else {
      console.log('❌ Cache invalidation failed');
    }
    
    // Test 9: Cache clear
    console.log('\n9. Testing cache clear...');
    await cacheManager.clear();
    const afterClear = cacheManager.getStats();
    if (afterClear.entryCount === 0) {
      console.log('✅ Cache clear successful');
    } else {
      console.log('❌ Cache clear failed');
    }
    
    console.log('\n🎉 All cache tests passed!');
    
  } catch (error) {
    console.error('❌ Cache test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testCache().catch(console.error); 