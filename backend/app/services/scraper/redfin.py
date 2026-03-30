import json
import re


def parse_redfin_url(url: str) -> tuple[str, str]:
    """Extract (property_id, url_path) from a Redfin URL."""
    match = re.search(r'redfin\.com(/[^?#]+/home/(\d+))', url)
    if not match:
        raise ValueError("Not a valid Redfin property URL")
    return match.group(2), match.group(1)


def parse_redfin_json(text: str) -> dict:
    """Strip Redfin's JSON hijacking prefix and parse."""
    prefix = "{}&&"
    if text.startswith(prefix):
        text = text[len(prefix):]
    return json.loads(text)


def map_property_type(redfin_type: str | None) -> str:
    """Map Redfin property type string to our enum."""
    if not redfin_type:
        return "single_family"
    lower = redfin_type.lower()
    if "condo" in lower or "co-op" in lower:
        return "condo"
    if "townhouse" in lower:
        return "townhouse"
    if "multi" in lower:
        return "multi_family"
    if "single" in lower:
        return "single_family"
    return "single_family"
