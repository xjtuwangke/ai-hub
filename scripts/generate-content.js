const fs = require('fs');
const path = require('path');

const skillsDir = path.join(__dirname, '..', 'skills');
const commandsDir = path.join(__dirname, '..', 'commands');
const mcpDir = path.join(__dirname, '..', 'mcp');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const skills = [
  {
    name: 'api-testing',
    version: '1.2.0',
    description: 'API testing strategy and automated test case generation',
    tags: ['qa', 'dev', 'testing', 'http', 'rest'],
    roles: ['qa', 'dev'],
    agents: ['opencode', 'codex', 'claude'],
    instructions: `# API Testing Skill

## Purpose
Generate comprehensive API test cases covering functional, boundary, and error scenarios.

## Workflow
1. Analyze API specs (OpenAPI, Swagger, or natural language description)
2. Identify input parameters, response schemas, and business rules
3. Design test cases: happy path, boundary values, error cases, security injection
4. Generate automation code in Jest, Pytest, or Postman Collection format

## Output
- Test case matrix with ID, scenario, input, expected output, priority
- Automated test scripts
- Mock data generation strategies`,
  },
  {
    name: 'code-review',
    version: '2.1.0',
    description: 'Code review best practices and automated checklists',
    tags: ['dev', 'qa', 'review', 'quality', 'best-practices'],
    roles: ['dev', 'qa'],
    agents: ['opencode', 'copilot', 'claude', 'codex'],
    instructions: `# Code Review Skill

## Dimensions
1. Correctness - logic, edge cases, error handling
2. Readability - naming, function length, comments
3. Performance - unnecessary loops, query optimization
4. Security - input validation, secrets handling
5. Maintainability - team conventions, test coverage

## Output Format
For each issue: severity (blocking/suggestion/nit), location, description, suggested fix`,
  },
  {
    name: 'security-audit',
    version: '1.5.0',
    description: 'OWASP Top 10 security auditing and vulnerability scanning',
    tags: ['qa', 'dev', 'security', 'audit', 'owasp'],
    roles: ['qa', 'dev'],
    agents: ['opencode', 'claude'],
    instructions: `# Security Audit Skill

## OWASP Top 10 Checklist
1. Injection (SQL, NoSQL, Command, LDAP)
2. Broken Authentication
3. Sensitive Data Exposure
4. XML External Entities (XXE)
5. Broken Access Control
6. Security Misconfiguration
7. Cross-Site Scripting (XSS)
8. Insecure Deserialization
9. Using Components with Known Vulnerabilities
10. Insufficient Logging and Monitoring

## Methodology
- Static code analysis for vulnerability patterns
- Dependency scanning for CVEs
- Configuration review for security headers`,
  },
  {
    name: 'test-automation',
    version: '1.3.0',
    description: 'End-to-end test automation frameworks and patterns',
    tags: ['qa', 'testing', 'automation', 'e2e', 'cicd'],
    roles: ['qa'],
    agents: ['opencode', 'codex', 'claude'],
    instructions: `# Test Automation Skill

## Frameworks
- UI: Playwright, Selenium, Cypress
- API: REST Assured, Supertest, Requests
- Mobile: Appium, Detox

## Patterns
- Page Object Model
- Given-When-Then (BDD)
- Data-driven testing
- Parallel execution strategies

## CI/CD Integration
- Test result reporting
- Flaky test detection
- Coverage thresholds`,
  },
  {
    name: 'frontend-performance',
    version: '1.1.0',
    description: 'Frontend performance optimization and Core Web Vitals',
    tags: ['dev', 'frontend', 'performance', 'optimization', 'web-vitals'],
    roles: ['dev'],
    agents: ['opencode', 'copilot', 'claude'],
    instructions: `# Frontend Performance Skill

## Core Web Vitals Targets
- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms
- CLS (Cumulative Layout Shift): < 0.1

## Optimization Areas
- Code splitting and lazy loading
- Image optimization (WebP, responsive images)
- Caching strategies
- Bundle size analysis
- Critical CSS extraction`,
  },
  {
    name: 'backend-optimization',
    version: '1.2.0',
    description: 'Backend performance tuning and scalability patterns',
    tags: ['dev', 'backend', 'performance', 'scalability', 'optimization'],
    roles: ['dev'],
    agents: ['opencode', 'codex', 'claude'],
    instructions: `# Backend Optimization Skill

## Areas
- Database query optimization (indexes, N+1)
- Caching layers (Redis, CDN)
- Async processing (queues, workers)
- Connection pooling
- API response compression

## Metrics
- P50/P95/P99 latency
- Throughput (RPS)
- Error rates
- Resource utilization`,
  },
  {
    name: 'database-design',
    version: '2.0.0',
    description: 'Relational and NoSQL database design patterns',
    tags: ['dev', 'database', 'design', 'sql', 'nosql'],
    roles: ['dev'],
    agents: ['opencode', 'copilot', 'claude'],
    instructions: `# Database Design Skill

## Principles
- Normalization vs denormalization tradeoffs
- Indexing strategies
- Partitioning and sharding
- Replication patterns
- Migration strategies

## Anti-patterns
- God tables
- Missing foreign keys
- N+1 queries
- Over-indexing`,
  },
  {
    name: 'ci-cd-pipeline',
    version: '3.1.0',
    description: 'CI/CD pipeline design and GitHub Actions workflows',
    tags: ['devops', 'cicd', 'pipeline', 'automation', 'github-actions'],
    roles: ['devops', 'dev'],
    agents: ['opencode', 'claude', 'copilot'],
    instructions: `# CI/CD Pipeline Skill

## Pipeline Stages
1. Build - compile, lint, type-check
2. Test - unit, integration, e2e
3. Security - SAST, DAST, dependency scan
4. Deploy - staging, canary, production
5. Verify - smoke tests, health checks

## Best Practices
- Pipeline as code
- Artifact immutability
- Secrets management
- Rollback strategies`,
  },
  {
    name: 'infrastructure-as-code',
    version: '2.3.0',
    description: 'Terraform, CloudFormation, and infrastructure automation',
    tags: ['devops', 'iac', 'terraform', 'cloud', 'aws'],
    roles: ['devops'],
    agents: ['opencode', 'claude'],
    instructions: `# Infrastructure as Code Skill

## Tools
- Terraform (multi-cloud)
- AWS CloudFormation
- Pulumi
- Ansible (configuration management)

## Patterns
- Module reusability
- State management (remote backend)
- Environment separation (workspaces)
- Drift detection`,
  },
  {
    name: 'incident-response',
    version: '1.0.0',
    description: 'Incident response playbooks and post-mortem templates',
    tags: ['devops', 'incident', 'response', 'monitoring', 'sre'],
    roles: ['devops'],
    agents: ['opencode', 'claude'],
    instructions: `# Incident Response Skill

## Phases
1. Detection - alerts, dashboards, on-call
2. Triage - severity assessment, communication
3. Mitigation - rollback, failover, hotfix
4. Resolution - root cause analysis
5. Post-mortem - timeline, lessons learned, action items

## Templates
- Incident communication (status page updates)
- Post-mortem document structure
- Runbook formats`,
  },
  {
    name: 'documentation-writing',
    version: '1.4.0',
    description: 'Technical documentation standards and templates',
    tags: ['ba', 'dev', 'documentation', 'writing', 'communication'],
    roles: ['ba', 'dev'],
    agents: ['opencode', 'copilot', 'claude'],
    instructions: `# Documentation Writing Skill

## Types
- API documentation (OpenAPI/Swagger)
- Architecture Decision Records (ADRs)
- Runbooks and playbooks
- User guides and onboarding docs

## Standards
- Diátaxis framework (tutorials, how-tos, reference, explanation)
- Markdown conventions
- Diagram as code (Mermaid, PlantUML)`,
  },
  {
    name: 'api-design',
    version: '2.2.0',
    description: 'RESTful and GraphQL API design principles',
    tags: ['dev', 'ba', 'api', 'design', 'rest', 'graphql'],
    roles: ['dev', 'ba'],
    agents: ['opencode', 'copilot', 'claude', 'codex'],
    instructions: `# API Design Skill

## REST Principles
- Resource-oriented URLs
- HTTP verbs (GET, POST, PUT, PATCH, DELETE)
- Status codes
- Pagination, filtering, sorting
- Versioning strategies

## GraphQL
- Schema design
- Resolver patterns
- N+1 problem and DataLoader
- Mutation design`,
  },
  {
    name: 'data-migration',
    version: '1.1.0',
    description: 'Database migration strategies and zero-downtime patterns',
    tags: ['dev', 'devops', 'data', 'migration', 'database'],
    roles: ['dev', 'devops'],
    agents: ['opencode', 'claude'],
    instructions: `# Data Migration Skill

## Strategies
- Blue-green migration
- Expand-contract pattern
- Dual-write with backfill
- Snapshot and replay

## Safety
- Migration rollback plans
- Data validation scripts
- Staging environment testing
- Monitoring and alerts`,
  },
  {
    name: 'accessibility-testing',
    version: '1.0.0',
    description: 'Web accessibility (a11y) testing and WCAG compliance',
    tags: ['qa', 'accessibility', 'testing', 'a11y', 'wcag'],
    roles: ['qa'],
    agents: ['opencode', 'claude'],
    instructions: `# Accessibility Testing Skill

## WCAG 2.1 Levels
- A (minimum)
- AA (recommended)
- AAA (enhanced)

## Tools
- axe-core (automated)
- Lighthouse accessibility audit
- Screen reader testing (NVDA, VoiceOver)
- Keyboard navigation testing

## Common Issues
- Missing alt text
- Insufficient color contrast
- Missing form labels
- Focus management`,
  },
  {
    name: 'load-testing',
    version: '1.2.0',
    description: 'Load testing, stress testing, and capacity planning',
    tags: ['qa', 'devops', 'load', 'performance', 'testing'],
    roles: ['qa', 'devops'],
    agents: ['opencode', 'claude'],
    instructions: `# Load Testing Skill

## Tools
- k6 (modern, developer-friendly)
- JMeter (enterprise)
- Artillery.io
- Locust (Python-based)

## Test Types
- Load test (expected traffic)
- Stress test (breaking point)
- Spike test (sudden traffic increase)
- Soak test (extended duration)

## Metrics
- Response time percentiles
- Throughput (requests/sec)
- Error rate
- Resource utilization`,
  },
  {
    name: 'code-refactoring',
    version: '1.3.0',
    description: 'Code refactoring techniques and legacy modernization',
    tags: ['dev', 'refactoring', 'clean-code', 'maintenance', 'legacy'],
    roles: ['dev'],
    agents: ['opencode', 'copilot', 'claude', 'codex'],
    instructions: `# Code Refactoring Skill

## Techniques
- Extract Method/Class
- Replace Conditional with Polymorphism
- Introduce Parameter Object
- Remove Duplicate Code
- Dependency Injection

## Safety
- Characterization tests
- Incremental refactoring
- Feature flags for risky changes
- Code review for large refactors`,
  },
  {
    name: 'dependency-management',
    version: '1.0.0',
    description: 'Dependency scanning, updates, and vulnerability management',
    tags: ['dev', 'dependencies', 'security', 'npm', 'supply-chain'],
    roles: ['dev'],
    agents: ['opencode', 'claude'],
    instructions: `# Dependency Management Skill

## Tools
- npm audit / yarn audit
- Snyk
- Dependabot
- OWASP Dependency-Check

## Practices
- Pin versions for reproducibility
- Regular update cadence
- License compliance checking
- SBOM generation`,
  },
  {
    name: 'logging-monitoring',
    version: '1.5.0',
    description: 'Observability, logging best practices, and monitoring setup',
    tags: ['devops', 'dev', 'logging', 'monitoring', 'observability'],
    roles: ['devops', 'dev'],
    agents: ['opencode', 'claude'],
    instructions: `# Logging and Monitoring Skill

## Logging
- Structured logging (JSON)
- Log levels (DEBUG, INFO, WARN, ERROR)
- Correlation IDs for distributed tracing
- Avoid logging sensitive data

## Monitoring
- Metrics (Prometheus, Grafana)
- Alerting rules (PagerDuty, OpsGenie)
- Dashboard design
- SLI/SLO/SLA definitions`,
  },
  {
    name: 'requirement-analysis',
    version: '2.0.0',
    description: 'Business requirement analysis and structured documentation',
    tags: ['ba', 'dev', 'requirements', 'analysis', 'documentation'],
    roles: ['ba', 'dev'],
    agents: ['opencode', 'copilot', 'claude'],
    instructions: `# Requirement Analysis Skill

## Process
1. Stakeholder identification
2. Current state analysis
3. Future state definition
4. Gap analysis
5. Acceptance criteria

## Outputs
- Product Requirements Document (PRD)
- User story maps
- Use case diagrams
- Acceptance test scenarios`,
  },
  {
    name: 'onboarding-guide',
    version: '1.0.0',
    description: 'Team onboarding, setup guides, and knowledge transfer',
    tags: ['all', 'onboarding', 'guide', 'team', 'knowledge'],
    roles: ['all'],
    agents: ['opencode', 'copilot', 'claude', 'codex'],
    instructions: `# Onboarding Guide Skill

## Topics
- Development environment setup
- Repository structure and conventions
- CI/CD pipeline overview
- Team communication channels
- Access provisioning

## Checklist
- [ ] Local dev environment running
- [ ] Test suite passing
- [ ] First PR merged
- [ ] Access to monitoring dashboards
- [ ] Introduced to team ceremonies`,
  },
];

const commands = [
  {
    name: '/code-review',
    version: '1.2.0',
    description: 'Execute comprehensive code review with security and performance checks',
    roles: ['dev', 'qa'],
    agents: ['opencode', 'claude', 'copilot'],
    tags: ['review', 'quality', 'dev'],
    dependencies: ['code-review'],
    body: `1. Scan changed files and understand the context
2. Check correctness - logic, edge cases, error handling
3. Check readability - naming, comments, structure
4. Check performance - unnecessary complexity, resource usage
5. Check security - input validation, secrets, injection risks
6. Provide structured feedback with severity levels`,
  },
  {
    name: '/security-audit',
    version: '1.1.0',
    description: 'Run OWASP Top 10 security audit on the codebase',
    roles: ['qa', 'dev'],
    agents: ['opencode', 'claude'],
    tags: ['security', 'audit', 'qa'],
    dependencies: ['security-audit'],
    body: `1. Scan for injection vulnerabilities (SQL, NoSQL, Command)
2. Check authentication and authorization logic
3. Review sensitive data handling and encryption
4. Validate input sanitization
5. Check dependency vulnerabilities
6. Review logging for sensitive data leakage
7. Generate prioritized remediation plan`,
  },
  {
    name: '/test-plan',
    version: '1.3.0',
    description: 'Generate comprehensive test plan with automation strategy',
    roles: ['qa'],
    agents: ['opencode', 'claude', 'codex'],
    tags: ['testing', 'qa', 'plan'],
    dependencies: ['api-testing', 'test-automation'],
    body: `1. Analyze requirements and acceptance criteria
2. Identify test types (unit, integration, e2e, performance)
3. Design test cases with boundary values
4. Define automation approach and framework selection
5. Estimate effort and create timeline
6. Define entry/exit criteria and test environment needs`,
  },
  {
    name: '/deploy-checklist',
    version: '2.0.0',
    description: 'Pre-deployment checklist for safe production releases',
    roles: ['devops', 'dev'],
    agents: ['opencode', 'claude'],
    tags: ['deploy', 'devops', 'checklist'],
    dependencies: ['ci-cd-pipeline', 'infrastructure-as-code'],
    body: `1. Verify all tests passing in CI
2. Check database migration compatibility
3. Confirm feature flags are configured
4. Verify monitoring and alerting are active
5. Prepare rollback procedure
6. Validate environment variables and secrets
7. Run smoke tests post-deployment`,
  },
  {
    name: '/requirement-doc',
    version: '1.0.0',
    description: 'Generate structured requirement document from raw input',
    roles: ['ba', 'dev'],
    agents: ['opencode', 'copilot', 'claude'],
    tags: ['requirements', 'ba', 'documentation'],
    dependencies: ['requirement-analysis', 'documentation-writing'],
    body: `1. Parse raw requirements or user stories
2. Identify stakeholders and personas
3. Define functional requirements
4. Define non-functional requirements (performance, security, usability)
5. Create acceptance criteria
6. Generate PRD with diagrams and traceability matrix`,
  },
];

const mcps = [
  {
    name: 'jira-mcp',
    description: 'Jira issue management and project tracking integration',
    version: '1.0.0',
    command: 'npx',
    args: ['@your-org/jira-mcp@latest'],
    roles: ['dev', 'qa', 'ba'],
    agents: ['opencode', 'copilot', 'claude', 'codex'],
    tags: ['project-management', 'jira', 'tracking'],
    env_required: ['JIRA_API_TOKEN', 'JIRA_HOST'],
    security_approved: true,
  },
  {
    name: 'internal-api-mcp',
    description: 'Internal API gateway for company services',
    version: '1.2.0',
    url: 'https://api-gateway.your-company.com/mcp',
    roles: ['dev', 'qa'],
    agents: ['opencode', 'copilot', 'claude'],
    tags: ['internal', 'api', 'gateway'],
    env_required: ['API_GATEWAY_TOKEN'],
    security_approved: true,
  },
];

function generateChangelog(skill) {
  return `# Changelog

## [${skill.version}] - 2026-05-20

- Initial release with core functionality
- Added support for ${skill.agents.join(', ')}

## [1.0.0] - 2026-01-15

- Project bootstrap
- Basic documentation
`;
}

for (const skill of skills) {
  const skillDir = path.join(skillsDir, skill.name);
  ensureDir(skillDir);

  fs.writeFileSync(
    path.join(skillDir, 'metadata.json'),
    JSON.stringify(
      {
        name: skill.name,
        version: skill.version,
        description: skill.description,
        tags: skill.tags,
        roles: skill.roles,
        agents: skill.agents,
        author: 'platform-team',
        security_grade: 'A',
        last_updated: '2026-05-20',
        changelog_file: 'CHANGELOG.md',
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.instructions}`
  );

  fs.writeFileSync(path.join(skillDir, 'CHANGELOG.md'), generateChangelog(skill));
}

for (const cmd of commands) {
  const cmdDir = path.join(commandsDir, cmd.name.replace(/^\//, ''));
  ensureDir(cmdDir);

  fs.writeFileSync(
    path.join(cmdDir, 'metadata.json'),
    JSON.stringify(
      {
        name: cmd.name,
        version: cmd.version,
        description: cmd.description,
        agents: cmd.agents,
        tags: cmd.tags,
        dependencies: cmd.dependencies,
        author: 'platform-team',
        last_updated: '2026-05-20',
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(cmdDir, 'COMMAND.md'),
    `---\nname: ${cmd.name}\ndescription: ${cmd.description}\n---\n\n${cmd.body}`
  );
}

for (const mcp of mcps) {
  fs.writeFileSync(path.join(mcpDir, `${mcp.name}.json`), JSON.stringify(mcp, null, 2));
}

console.log(`Generated ${skills.length} skills, ${commands.length} commands, ${mcps.length} mcps`);
