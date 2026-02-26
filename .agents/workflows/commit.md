---
description: How to safely stage and commit changes on Windows PowerShell
---

# Git Commit Workflow (PowerShell)

> PowerShell does not support `&&` for chaining commands. Use `;` (semicolons) instead.

## Steps

// turbo-all

1. **Stage all changes**
```powershell
git add .
```

2. **Commit with a descriptive message**
```powershell
git commit -m "type(scope): short description"
```
Use conventional commit prefixes: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

3. **Push to remote**
```powershell
git push
```

## Pre-commit type check (recommended)

Before committing, run the type checker to catch errors before they hit CI:
```powershell
npm run type-check
```

## One-liner (PowerShell-safe)

```powershell
git add . ; git commit -m "type(scope): message" ; git push
```

> ⚠️ Do NOT use `&&` in PowerShell — it will throw a parse error.
