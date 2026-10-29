# Visual search: step 1

This internal service converts an uploaded image into a normalized CLIP embedding.
It does not search the catalog yet and does not save customer images to Cloudinary.

Install Python 3.11 or 3.12 with the Windows Python launcher, then open PowerShell
inside this folder:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
```

Use `py -3.12` instead if that is the version installed. No environment activation
or PowerShell execution-policy change is needed.

The first start downloads the model. Wait for application startup to complete.
Open http://127.0.0.1:8001/health and then http://127.0.0.1:8001/docs.
For POST /embed, choose Try it out, upload a JPG/PNG/WebP and Execute.
Expect dimensions: 512 and an embedding array. This is not a product result or a
match percentage.

Check a non-image file and a file over 5 MB: both must be rejected.
The model is loaded once; inference runs outside the async event loop and is
serialized to avoid simultaneous CPU-heavy model calls.

Keep the service on loopback. Apache access to this folder is denied. Before any
remote deployment add PHP-to-service authentication and request limits. The PHP
endpoint, database indexing and customer UI are the next stages.

After a successful installation, record exact versions for the team:

```powershell
.\.venv\Scripts\python.exe -m pip freeze > requirements-lock.txt
```
