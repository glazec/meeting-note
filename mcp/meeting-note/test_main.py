import unittest

import main


class SqlSafetyTests(unittest.TestCase):
    def test_accepts_read_only_queries_against_public_ctes(self):
        sql = "select id, title from readable_meetings order by created_at desc"

        self.assertEqual(main._validate_agent_sql(sql), sql)

    def test_rejects_physical_tables_and_mutations(self):
        unsafe_queries = [
            "select * from meetings",
            "update readable_meetings set title = 'changed'",
            "select * from pg_catalog.pg_tables",
        ]

        for sql in unsafe_queries:
            with self.subTest(sql=sql):
                with self.assertRaises(ValueError):
                    main._validate_agent_sql(sql)

    def test_rejects_reserved_or_invalid_parameter_names(self):
        for params in ({"sql_user": "123"}, {"invalid-name": "123"}):
            with self.subTest(params=params):
                with self.assertRaises(ValueError):
                    main._normalize_sql_params(params)


class MeetingImagesPayloadTests(unittest.TestCase):
    def setUp(self):
        self.original_app_base_url = main.APP_BASE_URL

    def tearDown(self):
        main.APP_BASE_URL = self.original_app_base_url

    def test_builds_authenticated_app_route_urls(self):
        main.APP_BASE_URL = "https://app.example.com"
        payload = main._meeting_images_payload(
            "meeting-1",
            [
                {
                    "id": "asset-1",
                    "mime_type": "image/png",
                    "timestamp_ms": 65000,
                    "captured_at": None,
                },
                {
                    "id": "asset-2",
                    "mime_type": "image/jpeg",
                    "timestamp_ms": None,
                    "captured_at": None,
                },
            ],
        )

        self.assertTrue(payload["available"])
        self.assertEqual(payload["image_count"], 2)
        self.assertEqual(payload["requires_app_session"], True)
        self.assertEqual(
            payload["images"][0]["url"],
            "https://app.example.com/api/meetings/meeting-1/images/asset-1",
        )
        self.assertEqual(payload["images"][0]["timestamp_ms"], 65000)
        self.assertIsNone(payload["images"][1]["timestamp_ms"])

    def test_reports_missing_app_base_url(self):
        main.APP_BASE_URL = ""
        payload = main._meeting_images_payload("meeting-1", [])

        self.assertFalse(payload["available"])
        self.assertIn("APP_BASE_URL", payload["reason"])

    def test_marks_empty_image_lists_unavailable(self):
        main.APP_BASE_URL = "https://app.example.com"
        payload = main._meeting_images_payload("meeting-1", [])

        self.assertFalse(payload["available"])
        self.assertEqual(payload["image_count"], 0)
        self.assertEqual(payload["images"], [])


if __name__ == "__main__":
    unittest.main()
