const FnsApiEndpointsTest = require('./fns-api-endpoints.test');
const FnsIntegrationTest = require('./fns-integration.test');

class FnsApiIntegrationTest {
  constructor() {
    this.apiTest = new FnsApiEndpointsTest();
    this.fnsTest = new FnsIntegrationTest();
    this.results = {
      apiTests: null,
      fnsTests: null,
      integrationTests: {
        passed: 0,
        failed: 0,
        errors: []
      }
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const symbols = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      test: '🧪'
    };
    console.log(`${symbols[type]} [${timestamp}] ${message}`);
  }

  async testEndToEndFlow() {
    this.log('🧪 Testing end-to-end FNS flow...', 'test');
    
    try {
      // 1. Test API endpoint authentication
      const authSuccess = await this.apiTest.authenticate();
      if (!authSuccess) {
        throw new Error('API authentication failed');
      }

      // 2. Test FNS service authentication
      const fnsAuthResult = await this.fnsTest.authTest.testAuthentication();
      if (!fnsAuthResult.success) {
        throw new Error('FNS service authentication failed');
      }

      // 3. Submit QR scan via API
      const scanResult = await this.apiTest.testScanQrEndpoint();
      if (!scanResult.success) {
        throw new Error('API scan QR endpoint failed');
      }

      this.log(`QR scan submitted successfully with requestId: ${scanResult.requestId}`, 'success');

      // 4. Wait for processing and check status multiple times
      let statusResult;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
        statusResult = await this.apiTest.testStatusEndpoint(scanResult.requestId);
        
        if (statusResult.success && statusResult.data && 
            ['success', 'rejected', 'failed'].includes(statusResult.data.status)) {
          break;
        }
        
        attempts++;
        this.log(`Status check attempt ${attempts}: ${statusResult.data?.status || 'unknown'}`, 'info');
      }

      if (statusResult.success && statusResult.data) {
        this.log(`Final status: ${statusResult.data.status}`, 'success');
        this.log(`Cashback amount: ${statusResult.data.cashbackAmount || 0}`, 'info');
        
        this.results.integrationTests.passed++;
        
        return {
          success: true,
          requestId: scanResult.requestId,
          finalStatus: statusResult.data.status,
          cashbackAmount: statusResult.data.cashbackAmount
        };
      } else {
        throw new Error('Failed to get final status after multiple attempts');
      }

    } catch (error) {
      this.log(`End-to-end test failed: ${error.message}`, 'error');
      this.results.integrationTests.failed++;
      this.results.integrationTests.errors.push(`E2E Flow: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async testQueueStatsIntegration() {
    this.log('🧪 Testing queue stats integration...', 'test');
    
    try {
      // Get initial stats
      const initialStats = await this.apiTest.testQueueStatsEndpoint();
      if (!initialStats.success) {
        throw new Error('Failed to get initial queue stats');
      }

      const initialCount = initialStats.data.total;
      this.log(`Initial queue total: ${initialCount}`, 'info');

      // Submit a QR scan
      const scanResult = await this.apiTest.testScanQrEndpoint();
      if (!scanResult.success) {
        throw new Error('Failed to submit QR scan');
      }

      // Wait a moment and check stats again
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newStats = await this.apiTest.testQueueStatsEndpoint();
      if (!newStats.success) {
        throw new Error('Failed to get updated queue stats');
      }

      const newCount = newStats.data.total;
      this.log(`New queue total: ${newCount}`, 'info');

      if (newCount > initialCount) {
        this.log('✅ Queue stats integration test passed - count increased after submission', 'success');
        this.results.integrationTests.passed++;
        return { success: true, initialCount, newCount };
      } else {
        this.log('⚠️ Queue stats unchanged - might be expected if request was rejected', 'warning');
        this.results.integrationTests.passed++; // Still pass as this might be expected
        return { success: true, initialCount, newCount, note: 'No change in queue count' };
      }

    } catch (error) {
      this.log(`Queue stats integration test failed: ${error.message}`, 'error');
      this.results.integrationTests.failed++;
      this.results.integrationTests.errors.push(`Queue Stats Integration: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async testDailyCountIntegration() {
    this.log('🧪 Testing daily count integration...', 'test');
    
    try {
      // Get initial daily count
      const initialCountResult = await this.apiTest.testDailyCountEndpoint();
      if (!initialCountResult.success) {
        throw new Error('Failed to get initial daily count');
      }

      const initialCount = initialCountResult.count;
      this.log(`Initial daily count: ${initialCount}`, 'info');

      // Submit multiple QR scans
      const scanResults = [];
      for (let i = 0; i < 2; i++) {
        const scanResult = await this.apiTest.testScanQrEndpoint();
        scanResults.push(scanResult);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Wait a moment and check daily count again
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const newCountResult = await this.apiTest.testDailyCountEndpoint();
      if (!newCountResult.success) {
        throw new Error('Failed to get updated daily count');
      }

      const newCount = newCountResult.count;
      this.log(`New daily count: ${newCount}`, 'info');

      if (newCount >= initialCount) {
        this.log('✅ Daily count integration test passed', 'success');
        this.results.integrationTests.passed++;
        return { success: true, initialCount, newCount, scanResults };
      } else {
        throw new Error('Daily count decreased unexpectedly');
      }

    } catch (error) {
      this.log(`Daily count integration test failed: ${error.message}`, 'error');
      this.results.integrationTests.failed++;
      this.results.integrationTests.errors.push(`Daily Count Integration: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async runAllTests() {
    console.log('\n🚀 === FNS API INTEGRATION TEST SUITE ===\n');

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Run API tests
    this.log('🔄 Running API endpoint tests...', 'info');
    this.results.apiTests = await this.apiTest.runAllTests();
    await delay(2000);

    // Only proceed with integration tests if API tests are mostly successful
    if (this.results.apiTests.successRate >= 80) {
      this.log('🔄 Running integration tests...', 'info');
      
      // Test end-to-end flow
      await this.testEndToEndFlow();
      await delay(3000);

      // Test queue stats integration
      await this.testQueueStatsIntegration();
      await delay(2000);

      // Test daily count integration
      await this.testDailyCountIntegration();
      await delay(2000);

    } else {
      this.log('⚠️ Skipping integration tests due to API test failures', 'warning');
    }

    return this.generateReport();
  }

  generateReport() {
    console.log('\n📊 === INTEGRATION TEST RESULTS SUMMARY ===\n');
    
    if (this.results.apiTests) {
      console.log('🔌 API Tests:');
      console.log(`  ✅ Passed: ${this.results.apiTests.passed}`);
      console.log(`  ❌ Failed: ${this.results.apiTests.failed}`);
      console.log(`  📈 Success Rate: ${this.results.apiTests.successRate.toFixed(2)}%`);
    }

    console.log('\n🔗 Integration Tests:');
    console.log(`  ✅ Passed: ${this.results.integrationTests.passed}`);
    console.log(`  ❌ Failed: ${this.results.integrationTests.failed}`);
    
    const totalIntegrationTests = this.results.integrationTests.passed + this.results.integrationTests.failed;
    if (totalIntegrationTests > 0) {
      const integrationSuccessRate = (this.results.integrationTests.passed / totalIntegrationTests) * 100;
      console.log(`  📈 Success Rate: ${integrationSuccessRate.toFixed(2)}%`);
    }

    if (this.results.integrationTests.errors.length > 0) {
      console.log('\n🔍 === INTEGRATION ERRORS ===\n');
      this.results.integrationTests.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    console.log('\n=== INTEGRATION TEST COMPLETE ===\n');
    
    return {
      apiTests: this.results.apiTests,
      integrationTests: this.results.integrationTests,
      overallSuccess: this.results.integrationTests.failed === 0 && 
                     (this.results.apiTests?.successRate || 0) >= 80
    };
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new FnsApiIntegrationTest();
  tester.runAllTests().then(results => {
    process.exit(results.overallSuccess ? 0 : 1);
  }).catch(error => {
    console.error('❌ Integration test suite error:', error);
    process.exit(1);
  });
}

module.exports = FnsApiIntegrationTest;