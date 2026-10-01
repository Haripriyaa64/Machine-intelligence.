import json
import logging

from paho.mqtt import client as mqtt

from backend.app.core.config import get_settings
from backend.app.schemas.telemetry import TelemetryIn
from backend.app.services.ingestion import ingest_telemetry


logger = logging.getLogger(__name__)


class MQTTIngestor:
    def __init__(self):
        self.client = None
        self.started = False

    def start(self):
        settings = get_settings()

        if not settings.mqtt_enabled or self.started:
            return

        client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=settings.mqtt_client_id,
        )

        if settings.mqtt_username:
            client.username_pw_set(
                settings.mqtt_username,
                settings.mqtt_password,
            )

        if settings.mqtt_tls:
            client.tls_set()

        client.on_connect = self.on_connect
        client.on_message = self.on_message
        client.on_disconnect = self.on_disconnect

        self.client = client

        client.connect(
            settings.mqtt_host,
            settings.mqtt_port,
            keepalive=60,
        )

        client.loop_start()
        self.started = True

    def stop(self):
        if self.client is not None:
            self.client.disconnect()
            self.client.loop_stop()

        self.started = False
        self.client = None

    def on_connect(
        self,
        client,
        userdata,
        flags,
        reason_code,
        properties,
    ):
        if reason_code.is_failure:
            logger.error(
                "MQTT connection failed: %s",
                reason_code,
            )
            return

        topic = get_settings().mqtt_topic

        result, _ = client.subscribe(topic, qos=1)

        if result != mqtt.MQTT_ERR_SUCCESS:
            logger.error(
                "Could not subscribe to MQTT topic: %s",
                topic,
            )
            return

        logger.info("Subscribed to MQTT topic: %s", topic)

    def on_message(self, client, userdata, message):
        try:
            data = json.loads(
                message.payload.decode("utf-8")
            )

            item = TelemetryIn.model_validate(data)

            saved = ingest_telemetry(item)

            logger.info(
                "Saved MQTT reading id=%s status=%s",
                saved["id"],
                saved["status"],
            )

        except Exception:
            logger.exception(
                "Could not process MQTT message from topic %s",
                message.topic,
            )

    def on_disconnect(
        self,
        client,
        userdata,
        disconnect_flags,
        reason_code,
        properties,
    ):
        if reason_code.is_failure:
            logger.warning(
                "MQTT disconnected: %s",
                reason_code,
            )