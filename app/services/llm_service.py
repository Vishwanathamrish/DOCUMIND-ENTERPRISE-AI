"""
app/services/llm_service.py
──────────────────────────
Reusable Groq-based LLM service using ChatGroq (LangChain integration).
Provides a unified interface for all completion tasks.
"""
from functools import lru_cache
from typing import Optional, List, Dict, Any

from langchain_groq import ChatGroq
from langchain.prompts import ChatPromptTemplate
from langchain_core.messages import BaseMessage

from utils.config import get_settings
from utils.logger import logger

_settings = get_settings()


@lru_cache(maxsize=1)
def get_groq_llm(temperature: float = 0.0) -> ChatGroq:
    """
    Return a configured ChatGroq instance.
    Uses temperature=0 by default for deterministic responses.
    """
    if not _settings.groq_api_key:
        logger.error("GROQ_API_KEY is not set in environment.")
        raise ValueError("Missing GROQ_API_KEY configuration.")

    logger.debug("Initialising Groq LLM with model '%s' (temp=%.1f)…",
                 _settings.groq_model, temperature)
    
    return ChatGroq(
        groq_api_key=_settings.groq_api_key,
        model_name=_settings.groq_model,
        temperature=temperature,
        max_tokens=None,  # defaults to model max
        timeout=None,
        max_retries=2,
    )


import time

def execute_prompt(
    prompt_template: ChatPromptTemplate,
    variables: Dict[str, Any],
    temperature: float = 0.0
) -> str:
    """
    Execute a LangChain prompt template via Groq with automatic retries for rate limits.

    Args:
        prompt_template: LangChain chat prompt template.
        variables:       Variables to populate the template.
        temperature:    Override default temperature.

    Returns:
        Generated response content.
    """
    llm = get_groq_llm(temperature)
    chain = prompt_template | llm
    
    max_retries = 3
    retry_delay = 5  # seconds
    
    for attempt in range(max_retries):
        try:
            logger.debug("Executing Groq prompt (attempt %d/%d)…", attempt + 1, max_retries)
            response = chain.invoke(variables)
            content = response.content.strip() if hasattr(response, 'content') else str(response)
            return content
        except Exception as exc:
            error_msg = str(exc).lower()
            is_transient = any(x in error_msg for x in [
                "rate_limit_exceeded", "connection", "timeout", "service_unavailable", 
                "503", "504", "overloaded"
            ])
            
            if is_transient and attempt < max_retries - 1:
                logger.warning("Groq API transient error (attempt %d): %s. Retrying in %d seconds...", 
                               attempt + 1, exc, retry_delay)
                time.sleep(retry_delay)
                continue
            
            logger.exception("Groq API call failed permanently after %d attempts.", attempt + 1)
            raise RuntimeError(f"Error communicating with Groq: {exc}") from exc
