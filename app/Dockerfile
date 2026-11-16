# Semana 4: receta inmutable de la API (contexto de build = raíz del proyecto)
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# curl para el healthcheck de Docker Compose (Semana 5)
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
# Dependencias bloqueadas con hashes (requirements.lock) y solo wheels: no se ejecutan setup.py.
COPY app/requirements.lock app/requirements.lock
RUN pip install --no-cache-dir --only-binary :all: --require-hashes -r app/requirements.lock
COPY app/ app/

# La API no necesita privilegios de root.
RUN useradd --system --uid 1001 --no-create-home crediucc
USER crediucc

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
