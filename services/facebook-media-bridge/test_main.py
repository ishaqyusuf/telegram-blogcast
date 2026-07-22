import unittest

from main import (
    TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES,
    TELEGRAM_BOT_UPLOAD_LIMIT_BYTES,
    build_telegram_message_url,
    classify_media_delivery,
)


class MediaDeliveryTests(unittest.TestCase):
    def test_media_at_download_limit_stays_playable_in_app(self):
        self.assertEqual(
            classify_media_delivery(TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES),
            ("in_app", "telegram", None),
        )

    def test_media_above_download_limit_opens_in_telegram(self):
        self.assertEqual(
            classify_media_delivery(TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES + 1),
            ("external", "telegram", "telegram_download_limit"),
        )

    def test_media_at_upload_limit_still_opens_in_telegram(self):
        self.assertEqual(
            classify_media_delivery(TELEGRAM_BOT_UPLOAD_LIMIT_BYTES),
            ("external", "telegram", "telegram_download_limit"),
        )

    def test_media_above_upload_limit_opens_in_facebook(self):
        self.assertEqual(
            classify_media_delivery(TELEGRAM_BOT_UPLOAD_LIMIT_BYTES + 1),
            ("external", "facebook", "telegram_upload_limit"),
        )

    def test_builds_public_and_private_telegram_message_urls(self):
        self.assertEqual(
            build_telegram_message_url("@archive_channel", 42),
            "https://t.me/archive_channel/42",
        )
        self.assertEqual(
            build_telegram_message_url(-1001234567890, 42),
            "https://t.me/c/1234567890/42",
        )


if __name__ == "__main__":
    unittest.main()
