# M2L Image Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a local image to be associated with each post draft, stored in frontmatter, so Claude can view the image when drafting copy.

**Architecture:** Images are uploaded via a new Express endpoint, stored in `content/images/`, and referenced by relative path in draft frontmatter. The DetailPanel gains an image picker and preview. No automated test framework exists in this project — each task ends with a manual verification step.

**Tech Stack:** Express + multer (server), React (UI), gray-matter (frontmatter), Vite proxy (`/api` → `localhost:3001`)

---

### Task 1: Create images directory and install multer

**Files:**
- Create: `m2l-content-engine/content/images/.gitkeep`
- Modify: `m2l-content-engine/package.json`

- [ ] **Step 1: Create the images directory**

```bash
mkdir "m2l-content-engine/content/images"
touch "m2l-content-engine/content/images/.gitkeep"
```

- [ ] **Step 2: Install multer**

```bash
cd m2l-content-engine && npm install multer
```

Expected: `multer` appears in `package.json` dependencies and `package-lock.json` is updated.

- [ ] **Step 3: Verify install**

```bash
node -e "import('multer').then(m => console.log('multer ok', typeof m.default))"
```

Expected output: `multer ok function`

- [ ] **Step 4: Commit**

```bash
git add m2l-content-engine/content/images/.gitkeep m2l-content-engine/package.json m2l-content-engine/package-lock.json
git commit -m "chore: add content/images directory and install multer"
```

---

### Task 2: Add image endpoints to the Express server

**Files:**
- Modify: `m2l-content-engine/server/index.js`

- [ ] **Step 1: Add multer import and configuration**

At the top of `server/index.js`, after the existing imports, add:

```js
import multer from 'multer';

const IMAGES_PATH = path.join(ROOT, 'content', 'images');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGES_PATH),
  filename:    (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });
```

- [ ] **Step 2: Add POST /api/images endpoint**

After the existing `app.get('/api/posting-rules', ...)` block and before the `// --- Drafts ---` comment, add:

```js
// --- Images ---

app.post('/api/images', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ path: `images/${req.file.filename}` });
});

app.get('/api/images/:filename', async (req, res) => {
  const filepath = path.join(IMAGES_PATH, req.params.filename);
  try {
    await fs.access(filepath);
    res.sendFile(filepath);
  } catch {
    res.status(404).json({ error: 'Image not found' });
  }
});
```

- [ ] **Step 3: Manual verification**

Start the server:
```bash
cd m2l-content-engine && node server/index.js
```

In a separate terminal, upload a test image:
```bash
curl -X POST http://localhost:3001/api/images \
  -F "file=@/path/to/any/test.jpg" \
  -v
```

Expected response: `{"path":"images/test.jpg"}`

Then fetch it back:
```bash
curl -I http://localhost:3001/api/images/test.jpg
```

Expected: `HTTP/1.1 200 OK` with an image content-type header.

Stop the server. Delete `m2l-content-engine/content/images/test.jpg` if created.

- [ ] **Step 4: Commit**

```bash
git add m2l-content-engine/server/index.js
git commit -m "feat: add POST and GET /api/images endpoints"
```

---

### Task 3: Add uploadImage to useApi.js

**Files:**
- Modify: `m2l-content-engine/src/hooks/useApi.js`

- [ ] **Step 1: Add the uploadImage function**

Append to the end of `m2l-content-engine/src/hooks/useApi.js`:

```js
export const uploadImage = (file) => {
  const form = new FormData();
  form.append('file', file);
  return fetch(`${BASE}/images`, { method: 'POST', body: form })
    .then(json);
};
```

Note: do NOT set `Content-Type` header manually — the browser sets it automatically with the correct `multipart/form-data` boundary when using `FormData`.

- [ ] **Step 2: Commit**

```bash
git add m2l-content-engine/src/hooks/useApi.js
git commit -m "feat: add uploadImage API helper"
```

---

### Task 4: Add image picker and preview to DetailPanel

**Files:**
- Modify: `m2l-content-engine/src/components/DetailPanel.jsx`

- [ ] **Step 1: Import uploadImage**

Change the import at line 2 from:

```js
import { updateDraft } from '../hooks/useApi.js';
```

to:

```js
import { updateDraft, uploadImage } from '../hooks/useApi.js';
```

- [ ] **Step 2: Add image state**

Inside the `DetailPanel` component, after the existing `useState` declarations (around line 19), add:

```js
const [image, setImage] = useState('');
```

- [ ] **Step 3: Initialise image state from draft**

Inside the `useEffect` block (around line 23), add `image` initialisation so the block reads:

```js
useEffect(() => {
  if (draft) {
    setBody(draft.body ?? '');
    setStatus(draft.status ?? 'draft');
    setImage(draft.image ?? '');
  }
}, [draft?.filename]);
```

- [ ] **Step 4: Update the save function to include image**

Change the `save` function (around line 39) so `image` is included in the saved data:

```js
const save = async (overrides = {}) => {
  const updated = { ...draft, body, status, image, ...overrides };
  setSaving(true);
  await updateDraft(draft.filename, updated);
  onSave(updated);
  setSaving(false);
};
```

- [ ] **Step 5: Add handleImagePick handler**

After the `handleCopy` function (around line 56), add:

```js
const handleImagePick = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const { path } = await uploadImage(file);
  setImage(path);
  await save({ image: path });
};

const handleImageRemove = async () => {
  setImage('');
  await save({ image: '' });
};
```

- [ ] **Step 6: Add image section to JSX**

In the `return` block, between the `<div className="detail-meta">` block and the `<div className="status-toggles">` block, insert:

```jsx
<div className="detail-image">
  {image ? (
    <>
      <img
        src={`/api/images/${image.replace('images/', '')}`}
        alt="Post image"
        className="detail-image-preview"
      />
      <button className="btn-secondary image-remove-btn" onClick={handleImageRemove}>
        Remove image
      </button>
    </>
  ) : (
    <label className="btn-secondary image-pick-btn">
      Add image
      <input
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImagePick}
      />
    </label>
  )}
</div>
```

- [ ] **Step 7: Add minimal CSS**

In `m2l-content-engine/src/styles/index.css`, append:

```css
.detail-image {
  padding: 8px 16px;
}

.detail-image-preview {
  max-width: 100%;
  max-height: 200px;
  border-radius: 4px;
  display: block;
  margin-bottom: 8px;
}

.image-pick-btn,
.image-remove-btn {
  font-size: 0.85rem;
}
```

- [ ] **Step 8: Manual verification**

Start the full dev stack:
```bash
cd m2l-content-engine && npm run dev
```

Open the planner in the browser. Select any draft. Verify:
1. An "Add image" button appears between the metadata chips and the status toggles
2. Clicking "Add image" opens a native file picker
3. After selecting an image, a thumbnail preview appears
4. The draft file (in `content/drafts/`) now contains `image: images/<filename>` in its frontmatter — check with `cat m2l-content-engine/content/drafts/<filename>.md`
5. Refreshing the page and re-selecting the draft still shows the image
6. Clicking "Remove image" hides the preview and clears the `image` field from the frontmatter

- [ ] **Step 9: Commit**

```bash
git add m2l-content-engine/src/components/DetailPanel.jsx
git commit -m "feat: add image picker and preview to DetailPanel"
```
