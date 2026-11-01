# Contributing to AI Traffic Management Platform

Thank you for your interest in contributing to the **AI Traffic Management Platform**! This project was initiated under the **Carnegie Mellon University - Bridge Program (Group 5)** as an open-source adaptive traffic signal control system.

We welcome contributions from researchers, software engineers, and traffic systems enthusiasts.

---

## 🛠️ Development Setup

### 1. Prerequisites
- **Python 3.10+** (with virtual environment support)
- **Node.js 18+** & **npm**
- **Eclipse SUMO 1.20+** (for microscopic traffic simulation)
- **Arduino IDE / CLI** *(optional, for physical 12-LED hardware testing)*

### 2. Fork & Clone
```bash
git clone https://github.com/bendeze/ai-traffic-platform.git
cd ai-traffic-platform
```

### 3. Backend Setup
```bash
cd backend
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```

The web dashboard runs at `http://localhost:3000` (or `3001`).

---

## 🌿 Branching Strategy & Workflow

1. Create a feature or bugfix branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```
2. Follow clean code and commit message conventions ([Conventional Commits](https://www.conventionalcommits.org/)):
   - `feat(...)`: New capability or feature
   - `fix(...)`: Bug fix or patch
   - `refactor(...)`: Code cleanup with zero functional change
   - `docs(...)`: Documentation or image updates
   - `perf(...)`: Performance optimization

3. Verify both frontend and backend before submitting:
   ```bash
   # Frontend type & build check:
   cd frontend && npx tsc --noEmit && npm run build

   # Backend compile check:
   cd ../backend && python -m py_compile main.py
   ```

4. Push your branch and open a **Pull Request (PR)** against `main`.

---

## Code of Conduct

- Be respectful, constructive, and collaborative.
- Provide clear context, reproduction steps, or simulation logs in issues and pull requests.
- Ensure all hardware and simulation features remain safe, non-blocking, and fail-safe.
