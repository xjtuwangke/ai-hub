// Post-install script for test-plan command
// Sets up test plan templates and directory structure

const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

function createTemplate(templateDir) {
  const template = `# Test Plan Template

## Project Info
- Name: {{PROJECT_NAME}}
- Version: {{VERSION}}
- Date: {{DATE}}

## Test Strategy
1. Unit Tests
2. Integration Tests
3. E2E Tests
4. Performance Tests

## Test Cases
| ID | Scenario | Input | Expected | Priority |
|----|----------|-------|----------|----------|
| TC001 | | | | High |

## Environment
- URL: http://localhost:3000
- Browser: Chrome latest
- OS: macOS / Linux / Windows

## Automation
- Framework: Jest / Cypress / Playwright
- CI/CD: GitHub Actions

## Acceptance Criteria
- All P0 tests passing
- Coverage > 80%
- Performance SLA met
`;

  const templatePath = path.join(templateDir, 'test-plan-template.md');
  if (!fs.existsSync(templatePath)) {
    fs.writeFileSync(templatePath, template);
    console.log(`Created template: ${templatePath}`);
  }
}

(async () => {
  try {
    console.log('Setting up test-plan command...');
    
    const templateDir = path.join(process.cwd(), 'test-plans');
    ensureDir(templateDir);
    createTemplate(templateDir);
    
    console.log('test-plan command setup complete!');
    console.log(`Templates available at: ${templateDir}/`);
  } catch (error) {
    console.error('Setup failed:', error.message);
    process.exit(1);
  }
})();
