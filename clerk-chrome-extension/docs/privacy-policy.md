## Echo Exporter – Privacy & Data Use Policy (Human‑Readable Version)

This document explains, in plain language, what our extension does with your data, what it **never** does, and what controls you have.

---

### What the extension does

- **Purpose**: The extension helps you **export conversations** from tools like ChatGPT, Claude, LinkedIn, and similar platforms into a clean, reusable format.
- **How it works**: It runs entirely in your browser, scans the page’s HTML, finds message bubbles, and lets you select which messages to export.

---

### What data we access

To do its job, the extension needs to read parts of the web page you’re currently on:

- **We read:**
  - The visible **message content** in your conversation (user + assistant messages).
  - **Basic structure** of the page (HTML tags, CSS classes, data/ARIA attributes) related to the chat interface.
- **We do *not* intentionally read:**
  - Passwords, payment card details, or other credential fields.
  - Content from unrelated parts of the page that are clearly not part of a chat (e.g., navigation bars, ads, footers), though some structural HTML may still be inspected as part of layout detection.

All of this scanning happens **locally in your browser**.

---

### What is processed only on your device

By default, the following data is processed **entirely on your device and not sent to our servers**:

- The **full conversation text** you see in the exporter.
- The **selection state** of your messages (which ones you tick on/off).
- The **export result** (e.g., markdown, text, or other formats you save or copy).

In other words: the core job of “read page → find messages → export text” is done locally.

---

### When we use remote services (and what they see)

We use two types of remote services:

1. **Configuration storage (e.g., Supabase)**  
   - **What we store**:  
     - Per‑platform **CSS selectors and rules** that tell the extension how to find message bubbles and detect who is “you” vs “assistant”.
     - Occasionally, anonymized “layout signatures” or **candidate selectors** (CSS rules only), not full conversations.
   - **What we *don’t* store**:
     - Your actual message content.
     - Your account identifiers from the platforms you visit.
   - **Why**: This lets us fix broken selectors quickly when platforms change their UI, without waiting for a new extension release.

2. **LLM services (for optional “self‑healing” mode)**  
   - We may use a Large Language Model (LLM) **only in fallback situations**, for example when:
     - The extension can’t reliably detect messages, or
     - It detects an obviously broken conversation (e.g., many user messages but zero assistant messages).
   - **What we send in this case**:
     - A **heavily simplified and redacted HTML snapshot** focused on layout: tag names, classes, and structural hints.
     - Long text content is truncated; we aim to avoid including full messages wherever possible.
   - **What the LLM returns**:
     - **Selectors and rules** like “`.some-new-class` is a message bubble”, not your content.
   - **What we do *not* use the LLM for**:
     - Storing or analyzing your actual message content.
     - Building user profiles, personalization, or ads.

You can think of the LLM as a “mechanic” that helps us repair broken scraping rules, not as a place where your conversations live.

---

### Your controls and choices

We aim to give you **clear control** over any remote data use:

- **Local‑only mode**  
  - You can choose to **disable LLM fallback** and/or any “self‑healing” network features.  
  - In this mode, the extension:
    - Uses only built‑in / cached selectors.
    - Will **not send page snapshots** for repair.
    - May fail to read some conversations if the platform UI changes, but your data never leaves your device.

- **Self‑healing mode (default or opt‑in, depending on settings)**  
  - When enabled, the extension may:
    - Fetch updated selectors from our config backend.
    - Send **minimal, pruned HTML snapshots** to an LLM **only when scraping clearly fails**.
  - We’ll surface this clearly in the UI (for example: “We’re trying to auto‑repair this page. No full conversation text will be stored.”).

You can change these settings at any time in the extension’s options.

---

### Data retention

- **On your device**:
  - Cached selectors and small pieces of configuration may be stored in your browser’s extension storage to improve performance and resilience.
  - Your **exported data** lives wherever you save it (files, notes apps, etc.). We do **not** control or access that.

- **On our services**:
  - **Configuration data** (selectors, layout signatures) is stored until we no longer need it.
  - If we log failures or anonymized metrics (e.g., “ChatGPT layout broken, repair succeeded/failed”), these are aggregated and non‑content based.
  - We do **not** store raw conversation content as part of our normal operation.

We may retain standard server logs for security and debugging (e.g., IP, timestamps, errors), in line with common hosting practices.

---

### Security practices (high‑level)

- Communication with backend services (e.g., configuration database, LLM gateway) uses **encrypted connections (HTTPS)**.
- Access to configuration storage and LLM APIs is keyed and restricted to our backend or client keys as appropriate.
- We design our LLM prompts to **avoid leaking raw content** and to focus on **structure**, not semantics.

---

### Third‑party services we may use

We may rely on several third‑party providers, such as:

- A **database / backend service** (e.g., Supabase) to store platform selectors and configuration.
- A **Large Language Model provider** (e.g., OpenAI, Anthropic, etc.) for optional selector repair.

Each provider processes only the minimal data necessary for their role, and they have their own privacy policies and terms of use.

---

### When things go wrong (limitations & failures)

Despite all the above, a few things can still happen:

- The extension might **mis‑detect messages** if platforms radically change their layout.
- LLM fallback might **fail** to produce usable selectors.
- Our heuristics might **misjudge a “partial failure”**, and we may need to improve them over time.

When detection is unreliable, we aim to:

- **Tell you explicitly** in the UI (e.g., “We’re not confident we captured this conversation correctly.”).
- Offer you a way to **disable network features** if you prefer maximum privacy over robustness.

---

### How to contact us / give feedback

If you:

- Have privacy concerns,
- Want a stricter local‑only mode,
- Find a case where you think we sent more data than we should have,

please contact us through the channels listed in the extension’s store listing or documentation.

We genuinely want the safest, most transparent experience possible.

---

### Changes to this policy

If we change how the extension handles data (for example, introducing a new backend or new kind of processing), we will:

- Update this document, and
- Where reasonable, **surface a clear notice in the extension UI** (e.g., after an update) for any meaningful changes.


