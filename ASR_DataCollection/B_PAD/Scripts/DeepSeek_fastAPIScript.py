# deepseek_api.py
# Run with:
#   uvicorn DeepSeek_fastAPIScript:app --host 0.0.0.0 --port 8000

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests

app = FastAPI()

DEEPSEEK_URL = "http://127.0.0.1:11435/api/generate"  # host port 11435 -> container 11434

class DeepSeekRequest(BaseModel):
    prompt: str
    model: str = "deepseek-r1:8b"
    stream: bool = False

@app.post("/deepseek")
def run_deepseek(req: DeepSeekRequest):
    try:
        r = requests.post(
            DEEPSEEK_URL,
            json={"model": req.model, "prompt": req.prompt, "stream": req.stream},
            timeout=180,
        )
        r.raise_for_status()
        data = r.json()
        # Ollama-style response often contains "response"
        return {"response": data.get("response", ""), "raw": data}
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"DeepSeek request failed: {str(e)}")
