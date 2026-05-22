// Post-install script for api-testing skill
// This script validates that the required testing tools are available

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Running api-testing post-install script...');

// Check if Jest is available globally or locally
function checkJest() {
  try {
    execSync('npx jest --version', { stdio: 'pipe' });
    console.log('✅ Jest is available');
    return true;
  } catch {
    console.log('⚠️  Jest not found. You can install it later with: npm install --save-dev jest');
    return false;
  }
}

// Check if Postman CLI ( Newman ) is available
function checkNewman() {
  try {
    execSync('npx newman --version', { stdio: 'pipe' });
    console.log('✅ Newman (Postman CLI) is available');
    return true;
  } catch {
    console.log('⚠️  Newman not found. Install with: npm install -g newman');
    return false;
  }
}

// Create a sample test configuration file
function createSampleConfig() {
  const configPath = path.join(process.cwd(), 'api-test-config.json');
  const config = {
    baseUrl: 'http://localhost:3000',
    timeout: 5000,
    retries: 3,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('📝 Created sample api-test-config.json');
  }
}

// Main execution
(async () => {
  try {
    console.log('\n📋 API Testing Skill - Post Install Setup\n');
    
    checkJest();
    checkNewman();
    createSampleConfig();
    
    console.log('\n✅ Post-install setup complete!');
    console.log('💡 Tip: Customize api-test-config.json for your project\n');
  } catch (error) {
    console.error('❌ Post-install script failed:', error.message);
    process.exit(1);
  }
})();
