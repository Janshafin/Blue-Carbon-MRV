import os
import httpx


class PinataError(Exception):
    pass


async def upload_file(file_path: str) -> str:
    jwt = os.getenv("PINATA_JWT")

    if not jwt:
        raise PinataError("PINATA_JWT is not set")

    try:
        with open(file_path, "rb") as file:
            files = {
                "file": (
                    os.path.basename(file_path),
                    file,
                    "application/octet-stream",
                )
            }

            headers = {
                "Authorization": f"Bearer {jwt}",
            }

            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://uploads.pinata.cloud/v3/files",
                    headers=headers,
                    files=files,
                )

        if response.status_code >= 400:
            raise PinataError(
                f"Pinata returned HTTP {response.status_code}: "
                f"{response.text}"
            )

        data = response.json()

        cid = data.get("data", {}).get("cid")

        if not cid:
            raise PinataError(f"Pinata response missing CID: {data}")

        return f"ipfs://{cid}"

    except OSError as error:
        raise PinataError(f"Unable to read file: {error}") from error