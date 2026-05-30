from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    jwt_secret: str = "medianet-super-secret-jwt-key-2024-medianet-incubation"
    jwt_algorithm: str = "HS256"

    candidature_service_url: str = "http://localhost:8083"
    auth_service_url: str = "http://localhost:8081"

    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"

    matching_top_k: int = 5
    matching_similarity_threshold: float = 0.25

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
