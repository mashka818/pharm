# FNS API Tests

This directory contains comprehensive test suites for testing the FNS (Federal Tax Service) API integration in your application.

## Overview

The test suite includes:
- **API Endpoint Tests**: Test your application's FNS API endpoints
- **Integration Tests**: End-to-end testing combining API endpoints with FNS service
- **Existing FNS Service Tests**: Direct tests against FNS service (existing files)

## New Test Files

### 1. `fns-api-endpoints.test.js`
Tests all FNS API endpoints in your application:
- `POST /api/fns/scan-qr` - QR code scanning for promotions
- `POST /api/fns/verify` - Receipt verification (legacy)
- `GET /api/fns/status/:requestId` - Request status checking
- `GET /api/fns/queue/stats` - Queue statistics
- `GET /api/fns/daily-count` - Daily request count
- Authentication and validation tests

### 2. `fns-api-integration.test.js`
End-to-end integration tests:
- Complete QR scan flow from API to FNS service
- Queue statistics integration
- Daily count integration
- Status monitoring over time

### 3. `run-fns-api-tests.js`
Comprehensive test runner with options:
- Quick tests (API endpoints only)
- Full tests (API + integration)
- Detailed reporting and recommendations

## Quick Start

### Prerequisites

1. **Environment Setup**: Ensure your `.env` file contains:
   ```env
   PORT=4020
   DATABASE_URL=postgresql://...
   ROOT_ADMIN_USERNAME=admin
   ROOT_ADMIN_PASSWORD=admin
   JWT_SECRET=...
   FTX_API_URL=https://openapi.nalog.ru:8090
   FTX_TOKEN=your_fns_token_here
   ```

2. **Application Running**: Your NestJS application should be running on the specified port.

3. **Database**: Database should be accessible and migrations applied.

### Running Tests

#### Quick Tests (Recommended for development)
```bash
# Run API endpoint tests only (faster)
node tests/run-fns-api-tests.js --quick
```

#### Full Test Suite
```bash
# Run complete test suite including integration tests
node tests/run-fns-api-tests.js --full
```

#### Individual Test Files
```bash
# Run only API endpoint tests
node tests/fns-api-endpoints.test.js

# Run only integration tests
node tests/fns-api-integration.test.js
```

### Custom Configuration
```bash
# Use different base URL
BASE_URL=http://localhost:3000 node tests/run-fns-api-tests.js --quick

# Use different credentials
ROOT_ADMIN_USERNAME=testuser ROOT_ADMIN_PASSWORD=testpass node tests/run-fns-api-tests.js --quick
```

## Test Features

### Authentication Testing
- ✅ Tests that endpoints require authentication
- ✅ Tests with valid JWT tokens
- ✅ Tests unauthorized access blocking

### Data Validation Testing
- ✅ Tests with valid QR data
- ✅ Tests with invalid/malformed data
- ✅ Tests required field validation
- ✅ Tests data type validation

### API Endpoint Testing
- ✅ Tests all HTTP methods and endpoints
- ✅ Validates response structures
- ✅ Tests error handling
- ✅ Tests status codes

### Integration Testing
- ✅ End-to-end QR scan flow
- ✅ Status monitoring over time
- ✅ Queue statistics updates
- ✅ Daily count tracking

### Performance & Reliability
- ✅ Rate limiting handling
- ✅ Timeout handling
- ✅ Retry logic testing
- ✅ Concurrent request testing

## Test Data

The tests use realistic QR code data:
```javascript
{
  fn: '9287440300090728',     // Fiscal number
  fd: '77133',                // Fiscal document
  fp: '1482926127',           // Fiscal sign
  sum: 240000,                // Sum in kopecks (2400.00 rubles)
  date: '2019-04-09T16:38:00', // Receipt date
  typeOperation: 1            // Operation type (1 = purchase)
}
```

## Expected Results

### Successful Test Run
```
🚀 === FNS API TEST RUNNER ===
📅 Started at: 2024-01-15T10:30:00.000Z
🌐 Base URL: http://localhost:4020
🔑 FNS API URL: https://openapi.nalog.ru:8090

✅ Passed: 8
❌ Failed: 0
📈 Success Rate: 100.00%
🎯 Overall Status: ✅ PASSED
```

### Common Issues and Solutions

#### Authentication Failures
```
❌ Authentication failed. Status: 401
```
**Solution**: Check `ROOT_ADMIN_USERNAME` and `ROOT_ADMIN_PASSWORD` in your environment.

#### Connection Refused
```
❌ connect ECONNREFUSED 127.0.0.1:4020
```
**Solution**: Ensure your NestJS application is running on the expected port.

#### FNS Service Errors
```
❌ IP address not whitelisted for FNS
```
**Solution**: Contact FNS support to whitelist your server IP address.

#### Database Errors
```
❌ Can't reach database server
```
**Solution**: Check your `DATABASE_URL` and ensure the database is running.

## Test Report Interpretation

### Success Rates
- **100%**: All tests passed ✅
- **80-99%**: Minor issues, mostly functional ⚠️
- **50-79%**: Significant issues, needs attention ❌
- **<50%**: Major problems, requires immediate fixes 🚨

### Status Meanings
- **pending**: Request submitted, waiting for processing
- **processing**: FNS is currently processing the request
- **success**: Receipt verified successfully, cashback may be awarded
- **rejected**: Receipt rejected (invalid, return, or duplicate)
- **failed**: Technical failure in processing

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run FNS API Tests
  run: |
    npm install
    npm run build
    npm start &
    sleep 10
    node tests/run-fns-api-tests.js --quick
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    FTX_TOKEN: ${{ secrets.FTX_TOKEN }}
    ROOT_ADMIN_USERNAME: admin
    ROOT_ADMIN_PASSWORD: admin
```

### Docker Testing
```bash
# Run tests in Docker environment
docker-compose up -d
sleep 30
docker exec app_container node tests/run-fns-api-tests.js --quick
```

## Troubleshooting

### Debug Mode
Add detailed logging to tests:
```javascript
// In test files, set this to true for verbose output
const DEBUG_MODE = true;
```

### Manual Testing
Use the individual test classes for debugging:
```javascript
const FnsApiEndpointsTest = require('./tests/fns-api-endpoints.test');
const tester = new FnsApiEndpointsTest();

// Test individual endpoints
tester.authenticate().then(() => {
  return tester.testScanQrEndpoint();
}).then(result => {
  console.log('Scan result:', result);
});
```

### Network Issues
If you encounter network-related issues:
1. Check firewall settings
2. Verify FNS service availability
3. Test with different QR data
4. Check rate limiting

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Add proper error handling
3. Include validation for response formats
4. Update this README with new test descriptions

## Related Files

- `fns-auth.test.js` - Direct FNS authentication testing
- `fns-check.test.js` - Direct FNS receipt checking
- `fns-integration.test.js` - Direct FNS service integration
- `fns-errors.test.js` - FNS error handling tests
- `run-all-fns-tests.js` - Runner for original FNS service tests

The new API tests complement the existing FNS service tests by focusing on your application's API layer rather than the FNS service directly.