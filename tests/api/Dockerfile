# Semana 5: contenedor efímero test-runner (contexto = tests/api)
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /tests
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY test_*.py .
CMD ["pytest", "-v", "--tb=short", "-p", "no:cacheprovider"]
