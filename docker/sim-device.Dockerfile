# SIMULATED acquisition device: publishes generated ECG and pulse-vibration frames over MQTT.
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_RETRIES=10 PIP_DEFAULT_TIMEOUT=60
WORKDIR /app
RUN pip install numpy==2.3.5 paho-mqtt==2.1.0
COPY apps/api/app/__init__.py apps/api/app/telemetry_frames.py apps/api/app/
COPY workers/sim-device workers/sim-device
RUN useradd --system --uid 10001 medforge
USER medforge
ENTRYPOINT ["python", "/app/workers/sim-device/simulator.py"]
