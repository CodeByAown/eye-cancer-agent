from __future__ import annotations


async def test_scan_upload_and_analyze(client, png_bytes):
    # Upload
    files = {"file": ("eye.png", png_bytes, "image/png")}
    data = {"module": "eye", "workflow": "scanner"}
    r = await client.post("/api/v1/scans", files=files, data=data)
    assert r.status_code == 201, r.text
    scan = r.json()
    assert scan["status"] == "queued"
    scan_id = scan["id"]

    # Analyze (stub pipeline via orchestrator)
    r = await client.post(f"/api/v1/scans/{scan_id}/analyze")
    assert r.status_code == 200, r.text
    result = r.json()
    assert result["status"] == "done"
    assert result["prediction"]["top_label"]
    assert 0.0 <= result["prediction"]["top_confidence"] <= 1.0

    # Retrieve
    r = await client.get(f"/api/v1/scans/{scan_id}")
    assert r.status_code == 200
    assert r.json()["prediction"] is not None


async def test_reject_non_image(client):
    files = {"file": ("bad.png", b"not-an-image", "image/png")}
    data = {"module": "eye", "workflow": "scanner"}
    r = await client.post("/api/v1/scans", files=files, data=data)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"
