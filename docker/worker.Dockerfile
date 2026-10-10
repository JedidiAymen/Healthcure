# MEDFORGE inference worker: runs models in a separate process and container, never in the API.
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_RETRIES=10 PIP_DEFAULT_TIMEOUT=60
WORKDIR /app
COPY workers/fisav-stenosis/requirements.txt workers/fisav-stenosis/requirements.txt
RUN pip install -r workers/fisav-stenosis/requirements.txt
# The worker reuses the documented signal methods from the API source tree.
COPY apps/api/app/__init__.py apps/api/app/signal_processing.py apps/api/app/
COPY workers/fisav-stenosis workers/fisav-stenosis
RUN useradd --system --uid 10001 medforge && mkdir -p /artifacts && chown medforge /artifacts
USER medforge
ENTRYPOINT ["python", "/app/workers/fisav-stenosis/evaluate.py"]
