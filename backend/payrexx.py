"""Payrexx gateway helper — creates payment sessions and verifies webhooks.

Payrexx uses HMAC-SHA256 signing:
  - ApiSignature = base64( hmac_sha256(urlencoded_query_string_without_instance, api_secret) )
"""
import os
import base64
import hashlib
import hmac
import logging
from urllib.parse import urlencode, quote_plus

import httpx

logger = logging.getLogger("angeluccis.payrexx")

PAYREXX_BASE = "https://api.payrexx.com/v1.0"


def _sign(payload: dict, secret: str) -> str:
    """Compute the Payrexx ApiSignature for a flat payload (dict of str/int/float)."""
    qs = urlencode(payload, quote_via=quote_plus)
    mac = hmac.new(secret.encode("utf-8"), qs.encode("utf-8"), hashlib.sha256).digest()
    return base64.b64encode(mac).decode("utf-8")


def _flatten(d: dict, parent_key: str = "") -> dict:
    """Payrexx expects flat form keys like fields[email]=x. Flatten nested dicts."""
    items = {}
    for k, v in d.items():
        key = f"{parent_key}[{k}]" if parent_key else k
        if isinstance(v, dict):
            items.update(_flatten(v, key))
        else:
            items[key] = v
    return items


async def create_gateway(
    *,
    amount_chf: float,
    reference_id: str,
    success_url: str,
    failed_url: str,
    cancel_url: str,
    webhook_url: str,
    customer_email: str = "",
    customer_firstname: str = "",
    customer_lastname: str = "",
    purpose: str = "",
) -> dict:
    """Create a Payrexx Gateway (hosted checkout). Returns {id, link} on success.

    amount is passed to Payrexx in cents (int).
    """
    instance = os.environ.get("PAYREXX_INSTANCE", "").strip()
    secret = os.environ.get("PAYREXX_API_SECRET", "").strip()
    if not instance or not secret:
        raise RuntimeError("PAYREXX_INSTANCE / PAYREXX_API_SECRET missing in backend/.env")

    fields = {}
    if customer_email:
        fields["email"] = {"value": customer_email, "mandatory": 1}
    if customer_firstname:
        fields["forename"] = {"value": customer_firstname, "mandatory": 0}
    if customer_lastname:
        fields["surname"] = {"value": customer_lastname, "mandatory": 0}

    raw = {
        "amount": int(round(amount_chf * 100)),
        "currency": "CHF",
        "referenceId": reference_id,
        "purpose": (purpose or f"Commande {reference_id}")[:200],
        "successRedirectUrl": success_url,
        "failedRedirectUrl": failed_url,
        "cancelRedirectUrl": cancel_url,
    }
    if fields:
        raw.update(_flatten({"fields": fields}))

    signature = _sign(raw, secret)
    body = {**raw, "ApiSignature": signature}
    url = f"{PAYREXX_BASE}/Gateway/?instance={instance}"

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(url, data=body)
        # Log the raw body so we can see what Payrexx rejects
        if resp.status_code >= 400:
            logger.error("Payrexx %s response: %s", resp.status_code, resp.text[:1000])
            raise RuntimeError(f"Payrexx HTTP {resp.status_code}: {resp.text[:500]}")
        data = resp.json()

    if data.get("status") != "success":
        logger.error("Payrexx create_gateway failed: %s", data)
        raise RuntimeError(f"Payrexx error: {data.get('message', 'unknown')}")

    first = (data.get("data") or [{}])[0]
    return {
        "id": first.get("id"),
        "hash": first.get("hash"),
        "link": first.get("link"),
    }


async def get_gateway_status(gateway_id: int) -> str:
    """Retrieve current gateway state. Returns e.g. 'confirmed', 'waiting', 'cancelled'."""
    instance = os.environ.get("PAYREXX_INSTANCE", "").strip()
    secret = os.environ.get("PAYREXX_API_SECRET", "").strip()
    signature = _sign({}, secret)
    url = f"{PAYREXX_BASE}/Gateway/{gateway_id}/?instance={instance}&ApiSignature={signature}"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
    if data.get("status") != "success":
        return "unknown"
    first = (data.get("data") or [{}])[0]
    return first.get("status", "unknown")
