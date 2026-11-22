# Contributing

Thanks for taking the time to improve the project. Bug reports, ideas and pull requests are all welcome.

## Development setup

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cd frontend_nextjs && npm ci
```

## Before opening a pull request

```bash
ruff check . && ruff format --check .
pytest
cd frontend_nextjs && npm run lint && npm run typecheck && npm test && npm run build
```

CI runs the same checks on every push and pull request.

## Guidelines

- **Keep the two engines in step.** The Python engine (`simulation/`) and the browser engine
  (`frontend_nextjs/lib/simulation/`) model the same airport. If you change process logic in one,
  change the other and extend the tests on both sides.
- **Process parameters live in one place**: `simulation/parameters.py`. Run
  `python -m ml_models.export_artifacts` afterwards so the dashboard picks them up.
- **Models must keep a fallback.** Every model is optional at runtime; new ones should degrade
  gracefully and report their source in `result["engine"]`.
- **Report metrics against a baseline** on held-out data, as the existing training scripts do.
- Use clear commit messages in the imperative mood ("Add gate swap logic", "Fix queue metric").
