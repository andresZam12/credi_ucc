FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /infra
# Dependencias bloqueadas con hashes (requirements.lock) y solo wheels: no se ejecutan setup.py.
COPY requirements.lock .
RUN pip install --no-cache-dir --only-binary :all: --require-hashes -r requirements.lock
COPY init_infra.py .
RUN useradd --system --uid 1001 --no-create-home crediucc
USER crediucc
CMD ["python", "init_infra.py"]
