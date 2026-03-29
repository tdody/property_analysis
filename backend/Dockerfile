FROM python:3.13-slim

WORKDIR /app

RUN pip install pdm

COPY pyproject.toml pdm.lock ./

RUN pdm install --prod --no-lock --no-editable

COPY alembic.ini ./
COPY alembic/ ./alembic/
COPY app/ ./app/

EXPOSE 8000

CMD ["pdm", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
