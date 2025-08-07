#!/usr/bin/env node

const FnsApiEndpointsTest = require('./fns-api-endpoints.test');
const FnsApiIntegrationTest = require('./fns-api-integration.test');

class FnsTestRunner {
  constructor() {
    this.results = {
      startTime: new Date(),
      endTime: null,
      duration: 0,
      tests: {},
      summary: {
        totalPassed: 0,
        totalFailed: 0,
        overallSuccess: false
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
      test: '🧪',
      header: '🎯'
    };
    console.log(`${symbols[type]} [${timestamp}] ${message}`);
  }

  async runApiEndpointsTests() {
    this.log('Starting FNS API Endpoints Tests...', 'header');
    
    try {
      const tester = new FnsApiEndpointsTest();
      const results = await tester.runAllTests();
      
      this.results.tests.apiEndpoints = results;
      this.results.summary.totalPassed += results.passed;
      this.results.summary.totalFailed += results.failed;
      
      this.log(`API Endpoints Tests completed - ${results.passed} passed, ${results.failed} failed`, 
               results.failed === 0 ? 'success' : 'warning');
      
      return results;
    } catch (error) {
      this.log(`API Endpoints Tests failed with error: ${error.message}`, 'error');
      this.results.tests.apiEndpoints = { 
        passed: 0, 
        failed: 1, 
        errors: [error.message], 
        successRate: 0 
      };
      this.results.summary.totalFailed += 1;
      return this.results.tests.apiEndpoints;
    }
  }

  async runIntegrationTests() {
    this.log('Starting FNS Integration Tests...', 'header');
    
    try {
      const tester = new FnsApiIntegrationTest();
      const results = await tester.runAllTests();
      
      this.results.tests.integration = results;
      
      // Add integration test counts to summary
      if (results.integrationTests) {
        this.results.summary.totalPassed += results.integrationTests.passed;
        this.results.summary.totalFailed += results.integrationTests.failed;
      }
      
      this.log(`Integration Tests completed - ${results.integrationTests?.passed || 0} passed, ${results.integrationTests?.failed || 0} failed`, 
               results.overallSuccess ? 'success' : 'warning');
      
      return results;
    } catch (error) {
      this.log(`Integration Tests failed with error: ${error.message}`, 'error');
      this.results.tests.integration = { 
        overallSuccess: false,
        integrationTests: { passed: 0, failed: 1, errors: [error.message] }
      };
      this.results.summary.totalFailed += 1;
      return this.results.tests.integration;
    }
  }

  async runQuickTests() {
    this.log('Starting Quick FNS API Tests (endpoints only)...', 'header');
    
    const apiResults = await this.runApiEndpointsTests();
    
    this.results.endTime = new Date();
    this.results.duration = this.results.endTime - this.results.startTime;
    this.results.summary.overallSuccess = apiResults.successRate >= 80;
    
    return this.generateFinalReport();
  }

  async runFullTests() {
    this.log('Starting Full FNS API Test Suite...', 'header');
    
    // Run API endpoint tests first
    const apiResults = await this.runApiEndpointsTests();
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Run integration tests only if API tests are mostly successful
    if (apiResults.successRate >= 80) {
      this.log('API tests successful, proceeding with integration tests...', 'info');
      const integrationResults = await this.runIntegrationTests();
      
      this.results.summary.overallSuccess = integrationResults.overallSuccess;
    } else {
      this.log('API tests failed, skipping integration tests', 'warning');
      this.results.summary.overallSuccess = false;
    }
    
    this.results.endTime = new Date();
    this.results.duration = this.results.endTime - this.results.startTime;
    
    return this.generateFinalReport();
  }

  generateFinalReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 === FINAL TEST RESULTS SUMMARY ===');
    console.log('='.repeat(80));
    
    console.log(`\n⏱️  Test Duration: ${Math.round(this.results.duration / 1000)} seconds`);
    console.log(`📅 Start Time: ${this.results.startTime.toISOString()}`);
    console.log(`📅 End Time: ${this.results.endTime.toISOString()}`);
    
    console.log('\n📊 Test Results:');
    console.log(`   ✅ Total Passed: ${this.results.summary.totalPassed}`);
    console.log(`   ❌ Total Failed: ${this.results.summary.totalFailed}`);
    
    const totalTests = this.results.summary.totalPassed + this.results.summary.totalFailed;
    if (totalTests > 0) {
      const overallSuccessRate = (this.results.summary.totalPassed / totalTests) * 100;
      console.log(`   📈 Overall Success Rate: ${overallSuccessRate.toFixed(2)}%`);
    }
    
    console.log(`   🎯 Overall Status: ${this.results.summary.overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    
    // Detailed breakdown
    console.log('\n📋 Test Breakdown:');
    
    if (this.results.tests.apiEndpoints) {
      const api = this.results.tests.apiEndpoints;
      console.log(`   🔌 API Endpoints: ${api.passed} passed, ${api.failed} failed (${api.successRate?.toFixed(2)}% success)`);
    }
    
    if (this.results.tests.integration) {
      const integration = this.results.tests.integration;
      if (integration.integrationTests) {
        const int = integration.integrationTests;
        const intTotal = int.passed + int.failed;
        const intSuccessRate = intTotal > 0 ? (int.passed / intTotal) * 100 : 0;
        console.log(`   🔗 Integration: ${int.passed} passed, ${int.failed} failed (${intSuccessRate.toFixed(2)}% success)`);
      }
    }
    
    // Error summary
    const allErrors = [];
    if (this.results.tests.apiEndpoints?.errors) {
      allErrors.push(...this.results.tests.apiEndpoints.errors);
    }
    if (this.results.tests.integration?.integrationTests?.errors) {
      allErrors.push(...this.results.tests.integration.integrationTests.errors);
    }
    
    if (allErrors.length > 0) {
      console.log('\n🔍 Error Summary:');
      allErrors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    if (this.results.summary.overallSuccess) {
      console.log('   🎉 All tests passed! Your FNS API integration is working correctly.');
    } else {
      console.log('   🔧 Some tests failed. Please review the errors above and:');
      console.log('      - Check your environment variables (FTX_TOKEN, FTX_API_URL, etc.)');
      console.log('      - Ensure your server is running on the expected port');
      console.log('      - Verify database connectivity');
      console.log('      - Check if FNS service is accessible from your IP');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('=== TEST SUITE COMPLETE ===');
    console.log('='.repeat(80) + '\n');
    
    return this.results;
  }

  static printUsage() {
    console.log('\n📚 FNS API Test Runner Usage:');
    console.log('');
    console.log('  node run-fns-api-tests.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --quick     Run only API endpoint tests (faster)');
    console.log('  --full      Run complete test suite including integration tests');
    console.log('  --help      Show this help message');
    console.log('');
    console.log('Environment Variables:');
    console.log('  BASE_URL              Base URL of your application (default: http://localhost:4020)');
    console.log('  ROOT_ADMIN_USERNAME   Admin username for authentication (default: admin)');
    console.log('  ROOT_ADMIN_PASSWORD   Admin password for authentication (default: admin)');
    console.log('  FTX_TOKEN            FNS API token');
    console.log('  FTX_API_URL          FNS API URL (default: https://openapi.nalog.ru:8090)');
    console.log('');
    console.log('Examples:');
    console.log('  node run-fns-api-tests.js --quick');
    console.log('  node run-fns-api-tests.js --full');
    console.log('  BASE_URL=http://localhost:3000 node run-fns-api-tests.js --quick');
    console.log('');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    FnsTestRunner.printUsage();
    process.exit(0);
  }
  
  const runner = new FnsTestRunner();
  
  console.log('\n🚀 === FNS API TEST RUNNER ===\n');
  console.log(`📅 Started at: ${runner.results.startTime.toISOString()}`);
  console.log(`🌐 Base URL: ${process.env.BASE_URL || 'http://localhost:4020'}`);
  console.log(`🔑 FNS API URL: ${process.env.FTX_API_URL || 'https://openapi.nalog.ru:8090'}`);
  console.log('');
  
  let results;
  
  try {
    if (args.includes('--quick')) {
      results = await runner.runQuickTests();
    } else if (args.includes('--full')) {
      results = await runner.runFullTests();
    } else {
      // Default to quick tests
      console.log('ℹ️ No test mode specified, running quick tests. Use --full for complete suite.\n');
      results = await runner.runQuickTests();
    }
    
    // Exit with appropriate code
    process.exit(results.summary.overallSuccess ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Test runner failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = FnsTestRunner;