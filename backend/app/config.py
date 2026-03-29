from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./data/str_calc.db"

    model_config = {"env_prefix": ""}


settings = Settings()
