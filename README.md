# GroundFinder

GroundFinder is a fast single-image analysis tool that helps painters see dominant tone, value, temperature, and ground passages within a reference image. Upload an image (or paste one from the clipboard) to explore value and hue histograms, k-means color clusters, temperature maps, and ground-inside-forms overlays. The interface is optimised for quick toggling between highlight, wash, and extract views so painters can observe how a ground color weaves through objects.

## Tech Stack Choices
- **Frontend:** React + Vite + TypeScript. Vite keeps the dev loop fast and gives us access to modern tooling with minimal configuration. React provides the component and state model needed for interactive overlays and tabbed panels.
- **Backend:** FastAPI with NumPy, OpenCV, scikit-image, and scikit-learn. Python is a natural fit for color science work and keeps the image processing code shared with the optional notebook.
- **Image Processing:** Executed server-side to keep the front-end bundle light and to reuse the exact same functions for automated exports and the Ground Inside Forms overlay.

## Feature Overview
- Upload or paste an image (analysis runs on a copy downsampled so the long edge ≤ 1600 px).
- Perceptual value histogram (256 bins over Lab L*), hue histogram (360 bins over Lab hue angle), and numeric readouts.
- Temperature classification (warm, cool, neutral) with adjustable category selection and neutral threshold tied to chroma.
- Lab-space k-means clustering (k=5) with the most prevalent cluster highlighted by default; click any cluster to isolate it.
- Overlay modes with highlight, wash (other pixels fall to 15% opacity), and extract (transparent background) views.
- Value and hue isolation use soft tolerance bands (± bins / ± degrees) around the selected mode.
- Ground tools: auto-detect near-neutral mid-value clusters, set ground from a cluster or eyedrop sample, and analyse “ground inside forms” using edge detection and morphological region filling. Coverage metrics are reported alongside the overlay.
- Sampling panel reports RGB, Lab, LCH, hex, and relative value. Quick copy buttons place RGB or Lab values in the clipboard.
- PaintMaker bridge: copies the sampled RGB triplet to the clipboard before opening the PaintMaker mixer in a new tab.
- Export panel renders Highlight/Wash/Extract PNGs at full resolution plus a JSON summary of settings.
- Keyboard shortcuts: `1/2/3` switch between highlight/wash/extract and `[` / `]` adjust the value tolerance when that mode is active.

## Quick Start
### Prerequisites
- Python 3.10+ (3.13 tested)
- Node.js 18+

### One-click dev setup
```bash
./dev.sh
```
This script creates a Python virtual environment (if needed), installs backend dependencies, installs frontend packages, then launches FastAPI on `http://localhost:8000` and Vite on `http://localhost:5173` with live reload.

### Manual setup
```bash
# Backend
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
uvicorn app.main:app --reload

# Frontend (separate terminal)
npm --prefix frontend install
npm --prefix frontend run dev -- --host
```
Set `VITE_API_BASE_URL` if your backend runs on a different origin.

## Running Tests
```bash
# Backend unit tests
source backend/.venv/bin/activate
pytest backend/tests

# Frontend type check & build
npm --prefix frontend run build
```
Backend tests cover color conversions and mask construction boundaries.

## API Overview
- `POST /analyze` – ingest an image and return histograms, cluster summaries, and defaults.
- `POST /mask` – render highlight/wash/extract PNG overlays for the selected mode.
- `POST /ground-inside` – compute the “ground inside forms” overlay and coverage metrics.
- `POST /export` – full-resolution exports of all three overlay views plus the JSON summary.
- `GET /health` – lightweight readiness probe.

## Frontend Notes
- Tabs organise the right-hand column into Histograms, Clusters, Ground, Sampler, and Export panels.
- The canvas supports click sampling, drag-and-drop uploads, and clipboard paste.
- Ground selection can come from the detected cluster, any active cluster, or the sampler (eyedropper) data.
- The PaintMaker integration copies `R,G,B` to the clipboard before opening the mixer in a new tab. If the site blocks iframes, the new-tab flow is the reliable path; this behaviour is documented in comments and here to minimise breakage risk.

## Sample Assets & Notebook
- `samples/gray-table-lemons.png` – synthetic gray table with warm lemons used in the acceptance checks.
- `samples/ground-passages.png` – neutral interior with revealed ground accents.
- `notebooks/groundfinder_pipeline_demo.ipynb` – optional walkthrough using the backend helpers inside Jupyter.

## Container & Deployment
- **Docker:** `docker build -t groundfinder .` then `docker run -p 8000:8000 groundfinder`. The container builds the React frontend, bundles it into the image, and serves it alongside the FastAPI API on port 8000.
- **Railway:** Point the service at the repository root; Railway detects the Dockerfile automatically. No extra configuration is required beyond setting the service port (`$PORT` is handled by the container).

## Constraints & Deviations
- Temperature categories follow the spec’d warm/cool/neutral splits, but the warm split and neutral chroma slider are not yet exposed in the UI. The backend supports customisation and the UI can be extended with additional controls.
- The ground-inside-forms mask uses Canny edges plus morphological fills; it provides solid results on structured images but may need tuning for extremely noisy inputs.

## Acceptance Checklist
- [x] Upload `samples/gray-table-lemons.png` → dominant mid-value band + warm cluster isolates the lemons.
- [x] Set ground to a mid gray (detected cluster) → ground-inside-forms highlights thin gray passages under object silhouettes.
- [x] Eyedrop a pixel, then “Open in PaintMaker” → RGB copied to clipboard and PaintMaker opens in a new tab ready to paste.
- [x] Export panel saves highlight/wash/extract PNGs and the JSON summary.

Enjoy exploring how grounds weave through your reference imagery!
