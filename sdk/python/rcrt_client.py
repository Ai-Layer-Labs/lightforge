import json
import time
from typing import Any, Dict, List, Optional

import requests


class RcrtClient:
    def __init__(self, base_url: str, token: Optional[str] = None, timeout: int = 30) -> None:
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.timeout = timeout

    def _headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        if extra:
            h.update(extra)
        return h

    def health(self) -> str:
        r = requests.get(f"{self.base_url}/health", timeout=self.timeout)
        r.raise_for_status()
        return r.text

    def create_breadcrumb(self, body: Dict[str, Any], idempotency_key: Optional[str] = None) -> Dict[str, Any]:
        headers = self._headers({"Idempotency-Key": idempotency_key} if idempotency_key else None)
        r = requests.post(f"{self.base_url}/breadcrumbs", headers=headers, data=json.dumps(body), timeout=self.timeout)
        r.raise_for_status()
        return r.json()

    def get_breadcrumb(self, bc_id: str) -> Dict[str, Any]:
        r = requests.get(f"{self.base_url}/breadcrumbs/{bc_id}", headers=self._headers(), timeout=self.timeout)
        r.raise_for_status()
        return r.json()

    def get_breadcrumb_full(self, bc_id: str) -> Dict[str, Any]:
        r = requests.get(f"{self.base_url}/breadcrumbs/{bc_id}/full", headers=self._headers(), timeout=self.timeout)
        r.raise_for_status()
        return r.json()

    def list_breadcrumbs(self, tag: Optional[str] = None) -> List[Dict[str, Any]]:
        params = {"tag": tag} if tag else None
        r = requests.get(f"{self.base_url}/breadcrumbs", headers=self._headers(), params=params, timeout=self.timeout)
        r.raise_for_status()
        return r.json()

    def update_breadcrumb(self, bc_id: str, update: Dict[str, Any], expected_version: Optional[int] = None) -> Dict[str, Any]:
        headers = self._headers()
        if expected_version is not None:
            headers["If-Match"] = f'"{expected_version}"'
        r = requests.patch(f"{self.base_url}/breadcrumbs/{bc_id}", headers=headers, data=json.dumps(update), timeout=self.timeout)
        r.raise_for_status()
        return r.json()

    def delete_breadcrumb(self, bc_id: str) -> Dict[str, Any]:
        r = requests.delete(f"{self.base_url}/breadcrumbs/{bc_id}", headers=self._headers(), timeout=self.timeout)
        r.raise_for_status()
        return r.json()

    def register_agent(self, agent_id: str, roles: List[str]) -> Dict[str, Any]:
        r = requests.post(f"{self.base_url}/agents/{agent_id}", headers=self._headers(), data=json.dumps({"roles": roles}), timeout=self.timeout)
        r.raise_for_status()
        return r.json()

    def set_agent_secret(self, agent_id: str, secret: str) -> Dict[str, Any]:
        r = requests.post(f"{self.base_url}/agents/{agent_id}/secret", headers=self._headers(), data=json.dumps({"secret": secret}), timeout=self.timeout)
        r.raise_for_status()
        return r.json()

    def register_webhook(self, agent_id: str, url: str) -> Dict[str, Any]:
        r = requests.post(f"{self.base_url}/agents/{agent_id}/webhooks", headers=self._headers(), data=json.dumps({"url": url}), timeout=self.timeout)
        r.raise_for_status()
        return r.json()

    def create_selector(self, any_tags: Optional[List[str]] = None, all_tags: Optional[List[str]] = None, schema_name: Optional[str] = None) -> Dict[str, Any]:
        payload = {"any_tags": any_tags, "all_tags": all_tags, "schema_name": schema_name}
        r = requests.post(f"{self.base_url}/subscriptions/selectors", headers=self._headers(), data=json.dumps(payload), timeout=self.timeout)
        r.raise_for_status()
        return r.json()


