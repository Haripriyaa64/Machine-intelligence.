from backend.app.core.config import get_settings


def assess_reading(
    payload: dict,
) -> tuple[str, str | None]:
    settings = get_settings()

    critical_messages = []
    warning_messages = []

    temperature = payload.get("temperature_c")
    gas_raw = payload.get("gas_raw")
    vibration = payload.get("vibration_event")

    # Temperature assessment
    if temperature is not None:
        if temperature >= settings.temperature_critical_c:
            critical_messages.append(
                f"Temperature critically high: {temperature:.1f} °C"
            )

        elif temperature >= settings.temperature_warning_c:
            warning_messages.append(
                f"Temperature above warning threshold: "
                f"{temperature:.1f} °C"
            )

    # Raw gas sensor assessment
    if gas_raw is not None:
        if gas_raw >= settings.gas_raw_critical:
            critical_messages.append(
                f"Gas sensor raw reading critically high: {gas_raw}"
            )

        elif gas_raw >= settings.gas_raw_warning:
            warning_messages.append(
                f"Gas sensor raw reading above warning threshold: "
                f"{gas_raw}"
            )

    # Digital vibration event
    if vibration == 1:
        warning_messages.append(
            "Vibration event detected"
        )

    # Determine overall status
    if critical_messages:
        messages = critical_messages + warning_messages

        return "CRITICAL", "; ".join(messages)

    if warning_messages:
        return "WARNING", "; ".join(warning_messages)

    return "NORMAL", None