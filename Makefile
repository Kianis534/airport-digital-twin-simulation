# Convenience targets. On Windows, run the commands shown in README.md directly.
PY ?= python

.PHONY: install install-ml data train figures test lint api web streamlit

install:          ## Runtime + dev dependencies, frontend packages
	$(PY) -m pip install -r requirements-dev.txt
	cd frontend_nextjs && npm ci

install-ml:       ## Training dependencies (TensorFlow)
	$(PY) -m pip install -r requirements-ml.txt

data:             ## Clean datasets into outputs/
	$(PY) -m preprocessing.pipeline

train: data       ## Retrain models and refresh exported artifacts
	$(PY) -m ml_models.train_satisfaction_model
	$(PY) -m ml_models.train_traffic_model
	-$(PY) -m ml_models.train_delay_model
	$(PY) -m ml_models.export_artifacts

figures:          ## Regenerate README figures
	$(PY) notebooks/eda_report.py

test:             ## All tests
	$(PY) -m pytest
	cd frontend_nextjs && npm test

lint:
	ruff check . && ruff format --check .
	cd frontend_nextjs && npm run lint && npm run typecheck

api:
	uvicorn backend_fastapi.main:app --reload

web:
	cd frontend_nextjs && npm run dev

streamlit:
	streamlit run streamlit_app/app.py
