# Git Workflow Documentation

## Blue Carbon MRV — Branching Strategy & Git Conventions

> **Version**: 1.0  
> **Date**: 2026-08-28  
> **Repository**: [github.com/Janshafin/Blue-Carbon-MRV](https://github.com/Janshafin/Blue-Carbon-MRV)

---

## 1. Branching Strategy

Blue Carbon MRV uses a **trunk-based development model** adapted for a multi-team hackathon structure with a stable `main`, an integration branch for the Core Engine team, and feature branches for isolated development.

```mermaid
gitgraph
    commit id: "initial"
    branch core-engine
    commit id: "hardhat init"
    branch feature/core-engine-contract
    commit id: "BlueCarbonCredit.sol"
    commit id: "tests"
    checkout core-engine
    merge feature/core-engine-contract
    branch feature/core-engine-adapter
    commit id: "NDVI scoring"
    commit id: "core engine readme"
    checkout core-engine
    merge feature/core-engine-adapter
    checkout main
    merge core-engine
    branch feature/blue-carbon-mrv-pwa
    commit id: "PWA frontend"
    checkout main
    merge feature/blue-carbon-mrv-pwa
    branch feature/backend-api
    commit id: "FastAPI backend"
    checkout main
    merge feature/backend-api
    branch feature/mercury-landing-page
    commit id: "landing page"
    commit id: "dashboard"
```

---

## 2. Branch Hierarchy

| Branch | Purpose | Merge Target | Protection |
|---|---|---|---|
| `main` | Stable, release-ready code | — | PR-only merges |
| `core-engine` | Integration branch for Core Engine team | `main` | PR-only merges |
| `feature/*` | Feature development branches | `core-engine` or `main` | None |

### 2.1 Branch Naming Convention

```
feature/<team>-<description>
```

**Active branches:**

| Branch | Description | Status |
|---|---|---|
| `main` | Stable release branch | Protected |
| `core-engine` | Core Engine integration | Active |
| `feature/core-engine-contract` | Smart contract development | Merged |
| `feature/core-engine-adapter` | NDVI scoring + orchestration docs | Merged |
| `feature/blue-carbon-mrv-pwa` | PWA frontend (submission form) | Merged |
| `feature/backend-api` | FastAPI backend + Supabase integration | Merged |
| `feature/mercury-landing-page` | Landing page + dashboard | Active (current) |
| `feature/mangrove-submission-ui` | Submission UI refinements | Remote |

---

## 3. Workflow Rules

### 3.1 Feature Development

```bash
# 1. Create a feature branch from the integration branch
git checkout core-engine
git pull origin core-engine
git checkout -b feature/core-engine-<feature-name>

# 2. Develop and commit
git add .
git commit -m "feat: add <feature description>"

# 3. Push and create a Pull Request
git push -u origin feature/core-engine-<feature-name>
# → Open PR on GitHub targeting core-engine (or main)
```

### 3.2 Commit Message Convention

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>: <description>
```

| Type | Usage |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `test` | Test additions or modifications |
| `chore` | Tooling, dependencies, configuration |
| `refactor` | Code restructuring without behavior change |
| `merge` | Merge commits |

**Examples from the project history:**

```
feat: add BlueCarbonCredit contract with staged lifecycle
feat: add NDVI plausibility scoring service
feat: add BlueCarbonCredit ignition module
fix: configure Hardhat 3 Etherscan verification
test: handle viem contract reverts
docs: add core engine integration handoff
chore: add .gitignore, .env.example, README
merge: integrate PWA frontend into Blue Carbon Registry repo
feat: integrate NCCRRegistryConsole and update tsconfig
feat: Add Mercury design system landing page
```

### 3.3 Pull Request Process

1. **Create the PR** targeting `core-engine` (for Core Engine work) or `main` (for other teams)
2. **Title** follows the same conventional commit format
3. **Description** should include:
   - What changed and why
   - How to test
   - Screenshots for UI changes
4. **Review** by at least one team member
5. **Merge** via GitHub PR merge (not direct push to `main`)

### 3.4 Integration Flow

```
feature/core-engine-* → core-engine → main
feature/*             → main (for non-Core Engine teams)
```

---

## 4. Git History (Commit Log)

The project's commit history follows a clear chronological progression:

| # | Commit | Description | Phase |
|---|---|---|---|
| 1 | `chore: add .gitignore, .env.example, README` | Project scaffolding | Setup |
| 2 | `feat: initialize Hardhat 3 project with toolbox-viem and OpenZeppelin` | Hardhat 3 setup | Phase 1 |
| 3 | `feat: add BlueCarbonCredit contract with staged lifecycle` | Smart contract | Phase 1 |
| 4 | `test: handle viem contract reverts` | Test suite | Phase 1 |
| 5 | `feat: add BlueCarbonCredit ignition module` | Deployment module | Phase 1 |
| 6 | `fix: configure Hardhat 3 Etherscan verification` | Contract verification | Phase 1 |
| 7 | `feat: add NDVI plausibility scoring service` | NDVI scorer | Phase 2 |
| 8 | `docs: add core engine integration handoff` | Team documentation | Phase 2 |
| 9 | `feat: initial commit — PWA` | PWA frontend | Phase 3 |
| 10 | `merge: integrate PWA frontend` | Frontend integration | Phase 3 |
| 11 | `feat: Complete backend verification flow` | Backend API | Phase 3 |
| 12 | `feat: Add Mercury design system landing page` | Landing page | Phase 3 |
| 13 | `feat: integrate NCCRRegistryConsole and update tsconfig` | Dashboard | Phase 3 |

---

## 5. Environment Setup for Contributors

### 5.1 Prerequisites

- Node.js ≥ 22.13.0
- Python 3.10+
- Git
- MetaMask browser extension
- A Sepolia testnet wallet with ETH ([faucet](https://sepoliafaucet.com/))

### 5.2 Initial Setup

```bash
# Clone the repository
git clone https://github.com/Janshafin/Blue-Carbon-MRV.git
cd Blue-Carbon-MRV

# Install root dependencies (Hardhat, contracts)
npm install

# Install web dependencies
cd web && npm install && cd ..

# Copy environment templates
cp .env.example .env
# Edit .env with your real keys

# Set up web environment
# Create web/.env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### 5.3 Running Locally

```bash
# Smart contract tests
npx hardhat test

# NDVI scoring service
cd services/ndvi_scoring
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8001

# Backend API
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn backend.app.main:app --reload --port 8000

# Web frontend
cd web
npm run dev
```

### 5.4 Deployment

```bash
# Deploy contract to Sepolia
npx hardhat ignition deploy ignition/modules/BlueCarbonCredit.ts --network sepolia --verify

# Deploy web + scorer to Vercel
vercel --prod
```

---

## 6. Git Ignore Policy

Files excluded from version control (`.gitignore`):

| Category | Patterns |
|---|---|
| **Secrets** | `.env`, `.env.local`, `.env.*.local` |
| **Node.js** | `node_modules/`, `npm-debug.log*` |
| **Hardhat** | `artifacts/`, `cache/`, `typechain-types/`, `ignition/deployments/` |
| **Python** | `__pycache__/`, `*.py[cod]`, `.venv/`, `venv/` |
| **OS** | `.DS_Store`, `Thumbs.db`, `*.swp` |
| **IDE** | `.vscode/`, `.idea/` |
| **Build Output** | `dist/`, `dev-dist/`, `coverage/` |
| **Vercel** | `.vercel` |

---

## 7. Team Structure & Code Ownership

| Component | Directory | Team Members |
|---|---|---|
| Smart Contract | `contracts/`, `test/`, `scripts/` | Jan (Core Engine) |
| NDVI Scoring | `services/ndvi_scoring/` | Jan (Core Engine) |
| Backend API | `backend/`, `api/` | Jan, Arlin |
| Web Frontend | `web/` | All teams |
| Documentation | `docs/` | Jan |
| Infrastructure | `hardhat.config.ts`, `vercel.json`, `.env.example` | Jan |

---

## 8. Release Process

1. All feature branches are merged to `core-engine` or `main` via PR
2. `main` is always deployable — represents the latest stable release
3. Vercel auto-deploys from the connected branch
4. Contract deployments are manual via Hardhat Ignition with Etherscan verification
5. Tags are not currently used but should follow `v1.0.0` semver for production releases
