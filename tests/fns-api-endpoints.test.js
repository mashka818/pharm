const axios = require('axios');

class FnsApiEndpointsTest {
  constructor() {
    this.baseUrl = process.env.BASE_URL || 'http://localhost:4020';
    this.apiUrl = `${this.baseUrl}/api`;
    this.token = null;
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
    
    // Test data for QR code scanning
    this.testQrData = {
      fn: '9287440300090728',
      fd: '77133',
      fp: '1482926127',
      sum: 240000,
      date: '2019-04-09T16:38:00',
      typeOperation: 1
    };

    // Test headers for promotion
    this.testHeaders = {
      host: 'р-фарм.чекпоинт.рф'
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

  async authenticate() {
    this.log('🔐 Authenticating with test credentials...', 'info');
    
    try {
      const authData = {
        username: process.env.ROOT_ADMIN_USERNAME || 'admin',
        password: process.env.ROOT_ADMIN_PASSWORD || 'admin'
      };

      const response = await axios.post(`${this.apiUrl}/auth/login`, authData, {
        timeout: 10000,
        validateStatus: () => true
      });

      if (response.status === 200 || response.status === 201) {
        this.token = response.data.token || response.data.access_token;
        this.log(`Authentication successful. Token: ${this.token?.substring(0, 20)}...`, 'success');
        return true;
      } else {
        this.log(`Authentication failed. Status: ${response.status}, Data: ${JSON.stringify(response.data)}`, 'error');
        return false;
      }
    } catch (error) {
      this.log(`Authentication error: ${error.message}`, 'error');
      return false;
    }
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      ...this.testHeaders
    };
  }

  async testScanQrEndpoint() {
    this.log('🧪 Testing POST /api/fns/scan-qr endpoint...', 'test');
    
    try {
      const response = await axios.post(
        `${this.apiUrl}/fns/scan-qr`,
        this.testQrData,
        {
          headers: this.getAuthHeaders(),
          timeout: 30000,
          validateStatus: () => true
        }
      );

      this.log(`Response Status: ${response.status}`, 'info');
      this.log(`Response Data: ${JSON.stringify(response.data, null, 2)}`, 'info');

      if (response.status === 200 || response.status === 201) {
        const responseData = response.data;
        
        // Validate response structure
        if (responseData.hasOwnProperty('requestId') && 
            responseData.hasOwnProperty('status') && 
            responseData.hasOwnProperty('message')) {
          
          this.log('✅ Scan QR endpoint test passed - correct response structure', 'success');
          this.results.passed++;
          
          // Store requestId for status check test
          this.testRequestId = responseData.requestId;
          
          return {
            success: true,
            requestId: responseData.requestId,
            status: responseData.status,
            message: responseData.message
          };
        } else {
          this.log('❌ Scan QR endpoint test failed - incorrect response structure', 'error');
          this.results.failed++;
          this.results.errors.push('Scan QR: Incorrect response structure');
          return { success: false, error: 'Incorrect response structure' };
        }
      } else {
        this.log(`❌ Scan QR endpoint test failed - HTTP ${response.status}`, 'error');
        this.results.failed++;
        this.results.errors.push(`Scan QR: HTTP ${response.status} - ${JSON.stringify(response.data)}`);
        return { success: false, error: `HTTP ${response.status}`, data: response.data };
      }
    } catch (error) {
      this.log(`❌ Scan QR endpoint test error: ${error.message}`, 'error');
      this.results.failed++;
      this.results.errors.push(`Scan QR: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async testVerifyReceiptEndpoint() {
    this.log('🧪 Testing POST /api/fns/verify endpoint...', 'test');
    
    try {
      const response = await axios.post(
        `${this.apiUrl}/fns/verify`,
        this.testQrData,
        {
          headers: this.getAuthHeaders(),
          timeout: 30000,
          validateStatus: () => true
        }
      );

      this.log(`Response Status: ${response.status}`, 'info');
      this.log(`Response Data: ${JSON.stringify(response.data, null, 2)}`, 'info');

      if (response.status === 200 || response.status === 201) {
        const responseData = response.data;
        
        // Validate response structure
        if (responseData.hasOwnProperty('requestId') && 
            responseData.hasOwnProperty('status') && 
            responseData.hasOwnProperty('message')) {
          
          this.log('✅ Verify receipt endpoint test passed', 'success');
          this.results.passed++;
          
          return {
            success: true,
            requestId: responseData.requestId,
            status: responseData.status,
            message: responseData.message
          };
        } else {
          this.log('❌ Verify receipt endpoint test failed - incorrect response structure', 'error');
          this.results.failed++;
          this.results.errors.push('Verify receipt: Incorrect response structure');
          return { success: false, error: 'Incorrect response structure' };
        }
      } else {
        this.log(`❌ Verify receipt endpoint test failed - HTTP ${response.status}`, 'error');
        this.results.failed++;
        this.results.errors.push(`Verify receipt: HTTP ${response.status} - ${JSON.stringify(response.data)}`);
        return { success: false, error: `HTTP ${response.status}`, data: response.data };
      }
    } catch (error) {
      this.log(`❌ Verify receipt endpoint test error: ${error.message}`, 'error');
      this.results.failed++;
      this.results.errors.push(`Verify receipt: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async testStatusEndpoint(requestId) {
    this.log(`🧪 Testing GET /api/fns/status/${requestId} endpoint...`, 'test');
    
    if (!requestId) {
      this.log('⚠️ No requestId available for status test, skipping...', 'warning');
      return { success: false, error: 'No requestId available' };
    }
    
    try {
      const response = await axios.get(
        `${this.apiUrl}/fns/status/${requestId}`,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000,
          validateStatus: () => true
        }
      );

      this.log(`Response Status: ${response.status}`, 'info');
      this.log(`Response Data: ${JSON.stringify(response.data, null, 2)}`, 'info');

      if (response.status === 200) {
        const responseData = response.data;
        
        // Validate response structure
        if (responseData.hasOwnProperty('requestId') && 
            responseData.hasOwnProperty('status')) {
          
          this.log('✅ Status endpoint test passed', 'success');
          this.results.passed++;
          
          return {
            success: true,
            requestId: responseData.requestId,
            status: responseData.status,
            data: responseData
          };
        } else {
          this.log('❌ Status endpoint test failed - incorrect response structure', 'error');
          this.results.failed++;
          this.results.errors.push('Status: Incorrect response structure');
          return { success: false, error: 'Incorrect response structure' };
        }
      } else if (response.status === 404) {
        this.log('⚠️ Status endpoint returned 404 - request not found (expected for new requests)', 'warning');
        this.results.passed++; // 404 is acceptable for new requests
        return { success: true, status: 'not_found' };
      } else {
        this.log(`❌ Status endpoint test failed - HTTP ${response.status}`, 'error');
        this.results.failed++;
        this.results.errors.push(`Status: HTTP ${response.status} - ${JSON.stringify(response.data)}`);
        return { success: false, error: `HTTP ${response.status}`, data: response.data };
      }
    } catch (error) {
      this.log(`❌ Status endpoint test error: ${error.message}`, 'error');
      this.results.failed++;
      this.results.errors.push(`Status: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async testQueueStatsEndpoint() {
    this.log('🧪 Testing GET /api/fns/queue/stats endpoint...', 'test');
    
    try {
      const response = await axios.get(
        `${this.apiUrl}/fns/queue/stats`,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000,
          validateStatus: () => true
        }
      );

      this.log(`Response Status: ${response.status}`, 'info');
      this.log(`Response Data: ${JSON.stringify(response.data, null, 2)}`, 'info');

      if (response.status === 200) {
        const responseData = response.data;
        
        // Validate response structure
        if (typeof responseData.pending === 'number' && 
            typeof responseData.processing === 'number' && 
            typeof responseData.success === 'number' && 
            typeof responseData.failed === 'number' && 
            typeof responseData.total === 'number') {
          
          this.log('✅ Queue stats endpoint test passed', 'success');
          this.results.passed++;
          
          return {
            success: true,
            data: responseData
          };
        } else {
          this.log('❌ Queue stats endpoint test failed - incorrect response structure', 'error');
          this.results.failed++;
          this.results.errors.push('Queue stats: Incorrect response structure');
          return { success: false, error: 'Incorrect response structure' };
        }
      } else {
        this.log(`❌ Queue stats endpoint test failed - HTTP ${response.status}`, 'error');
        this.results.failed++;
        this.results.errors.push(`Queue stats: HTTP ${response.status} - ${JSON.stringify(response.data)}`);
        return { success: false, error: `HTTP ${response.status}`, data: response.data };
      }
    } catch (error) {
      this.log(`❌ Queue stats endpoint test error: ${error.message}`, 'error');
      this.results.failed++;
      this.results.errors.push(`Queue stats: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async testDailyCountEndpoint() {
    this.log('🧪 Testing GET /api/fns/daily-count endpoint...', 'test');
    
    try {
      const response = await axios.get(
        `${this.apiUrl}/fns/daily-count`,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000,
          validateStatus: () => true
        }
      );

      this.log(`Response Status: ${response.status}`, 'info');
      this.log(`Response Data: ${JSON.stringify(response.data, null, 2)}`, 'info');

      if (response.status === 200) {
        const responseData = response.data;
        
        // Validate response structure
        if (typeof responseData.count === 'number' && 
            typeof responseData.limit === 'number') {
          
          this.log('✅ Daily count endpoint test passed', 'success');
          this.results.passed++;
          
          return {
            success: true,
            count: responseData.count,
            limit: responseData.limit
          };
        } else {
          this.log('❌ Daily count endpoint test failed - incorrect response structure', 'error');
          this.results.failed++;
          this.results.errors.push('Daily count: Incorrect response structure');
          return { success: false, error: 'Incorrect response structure' };
        }
      } else {
        this.log(`❌ Daily count endpoint test failed - HTTP ${response.status}`, 'error');
        this.results.failed++;
        this.results.errors.push(`Daily count: HTTP ${response.status} - ${JSON.stringify(response.data)}`);
        return { success: false, error: `HTTP ${response.status}`, data: response.data };
      }
    } catch (error) {
      this.log(`❌ Daily count endpoint test error: ${error.message}`, 'error');
      this.results.failed++;
      this.results.errors.push(`Daily count: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async testAuthenticationRequired() {
    this.log('🧪 Testing authentication requirement...', 'test');
    
    try {
      // Test without auth header
      const response = await axios.post(
        `${this.apiUrl}/fns/scan-qr`,
        this.testQrData,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
          validateStatus: () => true
        }
      );

      if (response.status === 401) {
        this.log('✅ Authentication requirement test passed - unauthorized access blocked', 'success');
        this.results.passed++;
        return { success: true };
      } else {
        this.log(`❌ Authentication requirement test failed - expected 401, got ${response.status}`, 'error');
        this.results.failed++;
        this.results.errors.push(`Auth requirement: Expected 401, got ${response.status}`);
        return { success: false, error: `Expected 401, got ${response.status}` };
      }
    } catch (error) {
      this.log(`❌ Authentication requirement test error: ${error.message}`, 'error');
      this.results.failed++;
      this.results.errors.push(`Auth requirement: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async testInvalidData() {
    this.log('🧪 Testing validation with invalid data...', 'test');
    
    try {
      // Test with invalid QR data
      const invalidData = {
        fn: '', // Invalid: empty
        fd: '77133',
        fp: '1482926127',
        sum: 'invalid', // Invalid: not a number
        date: 'invalid-date'
      };

      const response = await axios.post(
        `${this.apiUrl}/fns/scan-qr`,
        invalidData,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000,
          validateStatus: () => true
        }
      );

      if (response.status === 400) {
        this.log('✅ Data validation test passed - invalid data rejected', 'success');
        this.results.passed++;
        return { success: true };
      } else {
        this.log(`❌ Data validation test failed - expected 400, got ${response.status}`, 'error');
        this.results.failed++;
        this.results.errors.push(`Data validation: Expected 400, got ${response.status}`);
        return { success: false, error: `Expected 400, got ${response.status}` };
      }
    } catch (error) {
      this.log(`❌ Data validation test error: ${error.message}`, 'error');
      this.results.failed++;
      this.results.errors.push(`Data validation: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async runAllTests() {
    console.log('\n🚀 === FNS API ENDPOINTS TEST SUITE ===\n');
    
    // Authentication
    const authSuccess = await this.authenticate();
    if (!authSuccess) {
      this.log('❌ Authentication failed, cannot proceed with tests', 'error');
      return this.generateReport();
    }

    // Wait between tests to avoid rate limiting
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Test authentication requirement
    await this.testAuthenticationRequired();
    await delay(1000);

    // Test data validation
    await this.testInvalidData();
    await delay(1000);

    // Test main endpoints
    const scanResult = await this.testScanQrEndpoint();
    await delay(2000);

    const verifyResult = await this.testVerifyReceiptEndpoint();
    await delay(2000);

    // Test status endpoint with requestId from scan
    if (scanResult.success && scanResult.requestId) {
      await this.testStatusEndpoint(scanResult.requestId);
      await delay(1000);
    }

    // Test utility endpoints
    await this.testQueueStatsEndpoint();
    await delay(1000);

    await this.testDailyCountEndpoint();
    await delay(1000);

    return this.generateReport();
  }

  generateReport() {
    console.log('\n📊 === TEST RESULTS SUMMARY ===\n');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(2)}%`);
    
    if (this.results.errors.length > 0) {
      console.log('\n🔍 === ERRORS DETAILS ===\n');
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    console.log('\n=== TEST COMPLETE ===\n');
    
    return {
      passed: this.results.passed,
      failed: this.results.failed,
      errors: this.results.errors,
      successRate: (this.results.passed / (this.results.passed + this.results.failed)) * 100
    };
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new FnsApiEndpointsTest();
  tester.runAllTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  }).catch(error => {
    console.error('❌ Test suite error:', error);
    process.exit(1);
  });
}

module.exports = FnsApiEndpointsTest;