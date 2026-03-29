"""
agents/base_agent.py
─────────────────────
Abstract base class for all agents in the pipeline.
Every agent receives a dict payload and returns an AgentResult.
"""
from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from utils.logger import logger


@dataclass
class AgentResult:
    """Standardised output envelope produced by every agent."""
    agent_name: str
    success: bool
    payload: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    elapsed_ms: float = 0.0

    def raise_if_failed(self) -> None:
        if not self.success:
            raise RuntimeError(f"[{self.agent_name}] failed: {self.error}")


class BaseAgent(ABC):
    """
    Every agent must implement `_execute(payload)`.
    The public `run(payload)` wraps it with logging, timing, and error handling.
    """

    name: str = "BaseAgent"

    def run(self, payload: dict[str, Any]) -> AgentResult:
        t0 = time.perf_counter()
        logger.info("[%s] starting…", self.name)
        try:
            result_payload = self._execute(payload)
            elapsed = (time.perf_counter() - t0) * 1000
            logger.info("[%s] completed in %.0f ms.", self.name, elapsed)
            return AgentResult(
                agent_name=self.name,
                success=True,
                payload=result_payload,
                elapsed_ms=elapsed,
            )
        except Exception as exc:  # noqa: BLE001
            elapsed = (time.perf_counter() - t0) * 1000
            logger.error("[%s] failed after %.0f ms: %s", self.name, elapsed, exc)
            return AgentResult(
                agent_name=self.name,
                success=False,
                error=str(exc),
                elapsed_ms=elapsed,
            )

    @abstractmethod
    def _execute(self, payload: dict[str, Any]) -> dict[str, Any]:
        """
        Core logic of the agent.
        Args:
            payload: dict passed in from the orchestrator / previous agent result.
        Returns:
            dict that will be merged into the pipeline's shared context.
        """
