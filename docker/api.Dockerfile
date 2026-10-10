# MEDFORGE API: FastAPI business logic. Datasets are mounted read-only at /datasets;
# the database and uploaded dose predictions live in the medforge-state volume.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app
COPY apps/api/requirements.txt apps/api/requirements.txt
COPY docker/api-requirements.txt docker/api-requirements.txt
RUN pip install -r docker/api-requirements.txt

# Same layout as the repository so ROOT-relative paths (migrations, content) resolve.
COPY apps/api/app apps/api/app
COPY db/migrations db/migrations
COPY content content
COPY scripts/seed_demo.py scripts/create_local_learning_user.py scripts/
COPY docker/api-entrypoint.sh /usr/local/bin/medforge-api
RUN sed -i 's/\r$//' /usr/local/bin/medforge-api && chmod 0755 /usr/local/bin/medforge-api \
    && useradd --system --uid 10001 --home /var/lib/medforge medforge \
    && mkdir -p /var/lib/medforge/db /var/lib/medforge/dose-artifacts \
    && chown -R medforge /var/lib/medforge

USER medforge
EXPOSE 8000
ENTRYPOINT ["medforge-api"]
