# Semana 5: contenedor efímero test-runner (contexto = tests/api)
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /tests
# Dependencias bloqueadas con hashes (requirements.lock) y solo wheels: no se ejecutan setup.py.
COPY requirements.lock .
RUN pip install --no-cache-dir --only-binary :all: --require-hashes -r requirements.lock
COPY test_*.py .
RUN useradd --system --uid 1001 --no-create-home crediucc
USER crediucc
CMD ["pytest", "-v", "--tb=short", "-p", "no:cacheprovider"]
