// Post-install script for api-testing skill
// This script validates that the required testing tools are available

const fs = require('fs');
const path = require('path');

console.log('Running api-testing post-install script...');

function createSampleConfig() {
  const configPath = path.join(process.cwd(), 'api-test-config.json');
  const config = {
    baseUrl: 'http://localhost:3000',
    timeout: 5000,
    retries: 3,
    headers: { 'Content-Type': 'application/json' }
  };
  
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Created sample api-test-config.json');
  }
}

function createSampleTest() {
  const testDir = path.join(process.cwd(), 'tests');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
    console.log('Created tests/ directory');
  }
  
  const testPath = path.join(testDir, 'api-example.test.js');
  const testContent = `describe('API Tests', () => {
  test('should return 200 on health check', async () => {
    const res = await fetch('http://localhost:3000/health');
    expect(res.status).toBe(200);
  });
});
`;
  if (!fs.existsSync(testPath)) {
    fs.writeFileSync(testPath, testContent);
    console.log('Created sample test: tests/api-example.test.js');
  }
}

(async () => {
  try {
    console.log('\nAPI Testing Skill - Post Install Setup\n');
    createSampleConfig();
    createSampleTest();
    console.log('\nPost-install setup complete!');
    console.log('Tip: Customize api-test-config.json for your project');
    console.log('Tip: Run tests with: npx jest\n');
  } catch (error) {
    console.error('Post-install script failed:', error.message);
    process.exit(1);
  }
})();
