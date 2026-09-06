import io
import unittest
from PIL import Image
from fastapi.testclient import TestClient

from services.ndvi_scoring.app.main import app
from services.ndvi_scoring.app.db import SessionLocal, SubmissionModel
from services.ndvi_scoring.app.pipeline import run_verification_pipeline


def create_dummy_jpeg() -> io.BytesIO:
    """Creates an in-memory test JPEG image."""
    img = Image.new("RGB", (100, 100), color=(34, 139, 34))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf


class TestBackendApiAndPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_health_check(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("status", data)
        self.assertIn("database", data)
        self.assertTrue(data["database"]["connected"])
        self.assertIn("satellite", data)
        self.assertIn("blockchain", data)

    def test_submission_validation_errors(self):
        # Missing photo
        resp = self.client.post("/api/submissions", data={
            "latitude": -3.465,
            "longitude": 114.091,
            "planting_date": "2024-01-15",
            "species": "Rhizophora mucronata",
            "ngo_id": "NGO-001",
            "wallet_address": "0x1234567890123456789012345678901234567890",
        })
        self.assertEqual(resp.status_code, 422)

        # Invalid wallet
        buf = create_dummy_jpeg()
        resp = self.client.post("/api/submissions", data={
            "latitude": -3.465,
            "longitude": 114.091,
            "planting_date": "2024-01-15",
            "species": "Rhizophora mucronata",
            "ngo_id": "NGO-001",
            "wallet_address": "invalid-wallet",
        }, files={"photo": ("tree.jpg", buf, "image/jpeg")})
        self.assertEqual(resp.status_code, 400)
        self.assertIn("wallet", resp.json()["detail"].lower())

        # Invalid latitude
        buf = create_dummy_jpeg()
        resp = self.client.post("/api/submissions", data={
            "latitude": 999.0,
            "longitude": 114.091,
            "planting_date": "2024-01-15",
            "species": "Rhizophora mucronata",
            "ngo_id": "NGO-001",
            "wallet_address": "0x1234567890123456789012345678901234567890",
        }, files={"photo": ("tree.jpg", buf, "image/jpeg")})
        self.assertEqual(resp.status_code, 400)
        self.assertIn("latitude", resp.json()["detail"].lower())

    def test_successful_submission_and_pipeline(self):
        buf = create_dummy_jpeg()
        test_wallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

        # 1. Post submission
        resp = self.client.post(
            "/api/submissions",
            data={
                "project_name": "East Kalimantan Mangrove Project",
                "latitude": -3.4653,
                "longitude": 114.0917,
                "planting_date": "2024-01-15",
                "species": "Rhizophora mucronata",
                "ngo_id": "NGO-BORNEO-01",
                "wallet_address": test_wallet,
                "description": "Mangrove saplings restoration along estuary.",
            },
            files={"photo": ("mangrove_photo.jpg", buf, "image/jpeg")},
        )
        self.assertEqual(resp.status_code, 202)
        body = resp.json()
        self.assertTrue(body["success"])
        submission_id = body["submission_id"]
        self.assertIsNotNone(submission_id)

        # 2. Synchronously run pipeline
        run_verification_pipeline(submission_id)

        # 3. Query submission status
        sub_resp = self.client.get(f"/api/submissions/{submission_id}")
        self.assertEqual(sub_resp.status_code, 200)
        sub_data = sub_resp.json()
        self.assertEqual(sub_data["species"], "Rhizophora mucronata")
        self.assertEqual(sub_data["ngo_id"], "NGO-BORNEO-01")

        # 4. Query verification details
        ver_resp = self.client.get(f"/api/submissions/{submission_id}/verification")
        self.assertEqual(ver_resp.status_code, 200)
        ver_data = ver_resp.json()
        self.assertEqual(ver_data["submission_id"], submission_id)
        self.assertIn(ver_data["verification_status"], ["VERIFIED", "CREDITED", "BLOCKCHAIN_PENDING", "REJECTED"])
        self.assertIsNotNone(ver_data["score"])
        self.assertIsNotNone(ver_data["ndvi_before"])
        self.assertIsNotNone(ver_data["ndvi_after"])

        # 5. Check Evidence
        ev_resp = self.client.get(f"/api/evidence/{submission_id}")
        self.assertEqual(ev_resp.status_code, 200)
        ev_data = ev_resp.json()
        self.assertEqual(ev_data["submission_id"], submission_id)
        self.assertEqual(ev_data["project"], "East Kalimantan Mangrove Project")

        # 6. Retrieve photo
        photo_resp = self.client.get(f"/api/evidence/{submission_id}/photo")
        self.assertEqual(photo_resp.status_code, 200)
        self.assertEqual(photo_resp.headers["content-type"], "image/jpeg")
        self.assertGreater(len(photo_resp.content), 0)

        # 7. Check Registry
        reg_resp = self.client.get("/api/registry")
        self.assertEqual(reg_resp.status_code, 200)
        reg_data = reg_resp.json()
        self.assertTrue(reg_data["success"])
        self.assertIsInstance(reg_data["projects"], list)


if __name__ == "__main__":
    unittest.main()
