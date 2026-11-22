# Streamlit control room

A Python-only dashboard for the airport digital twin. It calls the same `simulation`
engine and `ml_models` artifacts as the FastAPI service, so results match the API.

```bash
pip install -r requirements.txt
streamlit run streamlit_app/app.py
```

## Deploying

**Streamlit Community Cloud**: point a new app at this repository with
`streamlit_app/app.py` as the entry file. The root `requirements.txt` covers every
dependency.

**Hugging Face Spaces**: create a Streamlit Space, push this repository to it and add
this front matter to the top of the Space's `README.md`:

```yaml
---
title: Airport Digital Twin
emoji: ✈️
sdk: streamlit
app_file: streamlit_app/app.py
pinned: false
---
```
