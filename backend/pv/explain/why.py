"""Deterministic template explanations ('Why' block) per docs/02-UX-SPEC and docs/03-ARCHITECTURE."""



def generate_why_text(
    driver_tags: list[dict],
    smoke_summary: dict | None = None,
    language: str = "en",
) -> list[str]:
    """Generate deterministic, fact-grounded explanation sentences."""
    sentences = []
    # Check regional smoke
    smoke_driver = next((d for d in driver_tags if d.get("type") == "regional_smoke"), None)
    if smoke_driver:
        eta = smoke_driver.get("eta")
        conf = smoke_driver.get("confidence", "medium")
        if language == "hi":
            sentences.append("पंजाब और हरियाणा की पराली का धुआँ दोपहर बाद यहाँ पहुँच सकता है।")
        else:
            if eta and "from" in eta and "to" in eta:
                sentences.append(f"Smoke from agricultural fires in Punjab and Haryana may arrive between {eta['from'][-8:-3]} and {eta['to'][-8:-3]} UTC ({conf} confidence).")
            else:
                sentences.append(f"Smoke from agricultural fires in the northwest may reach Delhi today ({conf} confidence).")

    # Check local trapping
    trapping_driver = next((d for d in driver_tags if d.get("type") == "local_trapping"), None)
    if trapping_driver:
        if language == "hi":
            sentences.append("सुबह की शांत हवा और कम ऊँचाई की परत स्थानीय प्रदूषण को रोक रही है।")
        else:
            sentences.append("Calm morning winds and a shallow boundary layer are trapping local city emissions.")

    # Check dust
    dust_driver = next((d for d in driver_tags if d.get("type") == "dust"), None)
    if dust_driver:
        if language == "hi":
            sentences.append("हवा में धूल और मोटे कणों की मात्रा अधिक है।")
        else:
            sentences.append("Elevated coarse particles indicate regional dust transport.")

    # Default if no prominent driver
    if not sentences:
        if language == "hi":
            sentences.append("स्थानीय मौसमी परिस्थितियाँ सामान्य हैं। प्रदूषण का स्तर स्थिर बना हुआ है।")
        else:
            sentences.append("Local dispersion conditions are moderate. Pollution levels follow standard diurnal patterns.")

    return sentences
