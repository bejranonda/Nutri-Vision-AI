# Publishing Guide for NutriVision AI

This guide explains how to publish the NutriVision AI package to npm and prepare it for public distribution.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Pre-Publishing Checklist](#pre-publishing-checklist)
- [Version Management](#version-management)
- [Publishing to npm](#publishing-to-npm)
- [Post-Publishing Steps](#post-publishing-steps)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### 1. npm Account
- Create an account at [npmjs.com](https://www.npmjs.com/signup)
- Verify your email address
- (Optional) Set up two-factor authentication for security

### 2. npm CLI Authentication
Login to npm from your terminal:
```bash
npm login
```

Enter your:
- Username
- Password
- Email
- (If 2FA is enabled) One-time password

Verify you're logged in:
```bash
npm whoami
```

### 3. Package Scope Access
If publishing a scoped package (`@nutrivision/nutrivision-ai`):
- Ensure you have access to the `@nutrivision` scope
- Or create your own scope: `@yourusername/nutrivision-ai`

## Pre-Publishing Checklist

Before publishing, ensure:

### Documentation
- [ ] README.md is comprehensive and up-to-date
- [ ] CHANGELOG.md includes all changes for this version
- [ ] LICENSE file is present and correct
- [ ] CONTRIBUTING.md has clear guidelines
- [ ] All code examples in docs are tested and working

### Code Quality

Single combined gate (run from `frontend/`) — see `docs/ITERATION_PROCESS.md`:

- [ ] `npm run check:all` passes. This runs, in order:
  1. `npm run type-check` — `tsc --noEmit` strict.
  2. `npm run check:i18n` — every `t('key')` call site exists in all four locale JSONs (`th/en/de/da`). Catches the drift that let `scan.dishes_found` ship in an earlier release.
  3. `npm test` — Vitest (`tests/crypto.test.ts`, `tests/ai-prompt.test.ts`, `tests/schemas.test.ts`; **34 tests**).
- [ ] No linting errors: `npm run lint`
- [ ] Backend tests pass: `cd backend && pytest -q` (**129 tests**).

### Database migrations (if your change touches `frontend/src/db/schema.ts`)

- [ ] Matching SQL file under `frontend/drizzle/` (naming: `NNNN_description.sql`, idempotent with `IF NOT EXISTS`).
- [ ] Entry added to `frontend/drizzle/meta/_journal.json`.
- [ ] Verified locally: `npx wrangler d1 migrations apply eatinorder-db --local`.
- [ ] Plan for prod apply documented in the PR description: `npx wrangler d1 migrations apply eatinorder-db --remote`.

### Request validation (if your change adds a new `/api/*` route)

- [ ] New `z.object(...)` schema in `frontend/src/lib/schemas.ts`.
- [ ] Route `safeParse`s the body and returns `zodFailure(result.error)` with status 400 on failure.
- [ ] Unit test added under `frontend/tests/schemas.test.ts` for the happy path plus at least one boundary rejection.

### Package Configuration
- [ ] `package.json` has correct metadata:
  - Name
  - Version
  - Description
  - Keywords
  - Repository URL
  - License
  - Author
  - Homepage
- [ ] `.npmignore` excludes unnecessary files
- [ ] Test dry-run packaging:
  ```bash
  npm pack --dry-run
  ```

### Security
- [ ] No secrets in code (API keys, passwords, etc.)
- [ ] Dependencies have no critical vulnerabilities:
  ```bash
  npm audit
  ```
- [ ] `.env` files are in `.npmignore` and `.gitignore`

## Version Management

NutriVision AI follows [Semantic Versioning](https://semver.org/) (SemVer):

- **MAJOR** (1.0.0): Incompatible API changes
- **MINOR** (0.1.0): New features, backwards compatible
- **PATCH** (0.0.1): Bug fixes, backwards compatible

### Updating Version

Use npm's version commands:

```bash
# Patch release (1.0.0 -> 1.0.1)
npm version patch

# Minor release (1.0.0 -> 1.1.0)
npm version minor

# Major release (1.0.0 -> 2.0.0)
npm version major

# Pre-release (1.0.0 -> 1.0.1-beta.0)
npm version prerelease --preid=beta
```

This will:
1. Update version in `package.json`
2. Create a git commit with the version
3. Create a git tag

### Manual Version Update

Alternatively, manually edit `package.json`:
```json
{
  "version": "1.0.1"
}
```

Then commit and tag:
```bash
git add package.json
git commit -m "chore: bump version to 1.0.1"
git tag v1.0.1
```

## Publishing to npm

### 1. Test the Package Locally

Create a test package:
```bash
npm pack
```

This creates a `.tgz` file. Test installing it:
```bash
mkdir test-install
cd test-install
npm init -y
npm install ../nutrivision-nutrivision-ai-1.0.0.tgz
cd ..
rm -rf test-install
```

### 2. Publish to npm

#### First-Time Publishing

```bash
# Public package (recommended for open source)
npm publish --access public

# Private package (requires paid npm account)
npm publish
```

#### Subsequent Updates

```bash
# Update version first
npm version patch  # or minor/major

# Publish
npm publish --access public
```

### 3. Publishing Pre-releases

For beta or alpha versions:

```bash
# Update to pre-release version
npm version prerelease --preid=beta

# Publish with tag
npm publish --tag beta --access public
```

Users can install with:
```bash
npm install @nutrivision/nutrivision-ai@beta
```

### 4. Publish from CI/CD

For automated publishing (GitHub Actions example):

```yaml
# .github/workflows/publish.yml
name: Publish Package

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm test
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Post-Publishing Steps

### 1. Verify Publication

Check on npm:
- Visit: https://www.npmjs.com/package/@nutrivision/nutrivision-ai
- Verify version number is correct
- Check that README displays properly

Test installation:
```bash
npm install @nutrivision/nutrivision-ai
```

### 2. Update Repository

Push version tags to GitHub:
```bash
git push
git push --tags
```

### 3. Create GitHub Release

1. Go to: https://github.com/bejranonda/Nutri-Vision-AI/releases
2. Click "Draft a new release"
3. Select the version tag
4. Copy content from CHANGELOG.md for that version
5. Publish release

### 4. Update Documentation

- [ ] Update README badges if needed
- [ ] Update installation instructions
- [ ] Announce on social media / community channels
- [ ] Update project website

### 5. Monitor

After publishing:
- Check npm download stats
- Monitor GitHub issues for bug reports
- Watch for security vulnerabilities:
  ```bash
  npm audit
  ```

## Troubleshooting

### "You do not have permission to publish"

**Solution**: You need access to the package scope or change the package name:
```bash
# Option 1: Request access to @nutrivision scope
# Option 2: Change package name in package.json to your own scope
"name": "@yourusername/nutrivision-ai"
```

### "Package name too similar to existing package"

**Solution**: npm prevents typosquatting. Choose a more unique name:
```json
{
  "name": "@nutrivision/nutrivision-ai-full-stack"
}
```

### "npm publish" hangs or times out

**Solution**: Check your network connection or try:
```bash
npm publish --registry=https://registry.npmjs.org/
```

### Version already exists

**Solution**: You can't republish the same version. Bump version:
```bash
npm version patch
npm publish --access public
```

### Large package size

Check what's being included:
```bash
npm pack --dry-run
```

Add exclusions to `.npmignore`:
```
# .npmignore
*.log
tests/
coverage/
.github/
```

### Authentication issues

Re-login to npm:
```bash
npm logout
npm login
```

Or use an automation token:
```bash
npm login --auth-type=legacy
```

## Best Practices

### 1. Test Before Publishing
Always run tests and test installation locally before publishing.

### 2. Update CHANGELOG
Keep CHANGELOG.md updated with every release.

### 3. Use Tags for Pre-releases
Don't pollute the `latest` tag with beta versions:
```bash
npm publish --tag beta
```

### 4. Semantic Versioning
Strictly follow SemVer to help users understand impact of updates.

### 5. Deprecate Old Versions
If a version has critical bugs:
```bash
npm deprecate @nutrivision/nutrivision-ai@1.0.0 "Critical bug, please upgrade"
```

### 6. Unpublish Carefully
**Warning**: Unpublishing is permanent and should be avoided!

Only unpublish if:
- Published by mistake within 72 hours
- Contains sensitive data

```bash
npm unpublish @nutrivision/nutrivision-ai@1.0.0
```

## Maintenance Releases

### Security Patches

For critical security fixes:

1. Create a patch branch:
   ```bash
   git checkout -b security-patch
   ```

2. Fix the issue

3. Run security audit:
   ```bash
   npm audit fix
   ```

4. Bump patch version:
   ```bash
   npm version patch
   ```

5. Publish immediately:
   ```bash
   npm publish --access public
   ```

6. Announce security update to users

### Deprecating Versions

If you need to deprecate a version:
```bash
npm deprecate @nutrivision/nutrivision-ai@1.0.0 "Please upgrade to 1.1.0"
```

## Support

For publishing help:
- npm documentation: https://docs.npmjs.com/
- npm support: https://www.npmjs.com/support
- Project issues: https://github.com/bejranonda/Nutri-Vision-AI/issues

---

## Quick Reference

```bash
# Pre-publish checks
npm test
npm run lint
npm pack --dry-run

# Version bump
npm version [patch|minor|major|prerelease]

# Publish
npm publish --access public

# Verify
npm view @nutrivision/nutrivision-ai

# Push to git
git push && git push --tags
```

---

**Ready to publish?** Follow the checklist and you're good to go! 🚀

*"เผยแพร่เพื่อสุขภาพที่ดีของทุกคน" - Publishing for everyone's better health*
