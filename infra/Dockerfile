FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /infra
RUN pip install --no-cache-dir boto3==1.35.81
COPY init_infra.py .
CMD ["python", "init_infra.py"]
