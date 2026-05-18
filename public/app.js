const panelSwitches = document.querySelectorAll("[data-panel-target]");
const panelTabs = document.querySelectorAll(".panel-tab");
const panelForms = document.querySelectorAll("[data-panel]");
const uploadBoxes = document.querySelectorAll(".upload-box");
const resultForm = document.querySelector(".result-form");
const searchResultsForm = document.querySelector("[data-search-results-form]");
const listingResults = document.querySelector("[data-listing-results]");
const resultsCount = document.querySelector("[data-results-count]");
const resultsSummary = document.querySelector("[data-results-summary]");
const activeFilters = document.querySelector("[data-active-filters]");
const emptyResults = document.querySelector("[data-empty-results]");
const clearSearchFiltersButton = document.querySelector("[data-clear-search-filters]");
const loadingTitle = document.querySelector("[data-loading-title]");
const loadingEyebrow = document.querySelector("[data-loading-eyebrow]");
const loadingMessage = document.querySelector("[data-loading-message]");
const loadingQuery = document.querySelector("[data-loading-query]");
const aiListingStatuses = document.querySelectorAll("[data-ai-listing-status]");
const reviewedParts = document.querySelector("[data-reviewed-parts]");
const uploadedPreview = document.querySelector("[data-uploaded-preview]");
const uploadedCount = document.querySelector("[data-uploaded-count]");
const photoMeta = document.querySelector("[data-photo-meta]");
const resultStatus = document.querySelector("[data-result-status]");
const listingDraftStorageKey = "autoreviverListingDraft";
const pendingListingStorageKey = "autoreviverPendingListing";
const pendingSearchStorageKey = "autoreviverPendingSearch";
const searchResultsStorageKey = "autoreviverSearchResults";

let availablePartListings = [];
let selectedResultPart = null;
let aiSearchContext = null;

const setActivePanel = (targetPanel) => {
  panelForms.forEach((form) => {
    form.classList.toggle("is-active", form.dataset.panel === targetPanel);
  });

  panelTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.panelTarget === targetPanel);
  });
};

const collectFormSearchParams = (form) => {
  const searchParams = new URLSearchParams();
  const formData = new FormData(form);

  formData.forEach((value, key) => {
    if (value instanceof File || !String(value).trim()) return;
    searchParams.set(key, String(value).trim());
  });

  return searchParams;
};

const getPrimaryRequestText = (searchParams) =>
  searchParams.get("part") ||
  searchParams.get("partNumber") ||
  searchParams.get("part-number") ||
  searchParams.get("plate") ||
  [searchParams.get("brand"), searchParams.get("model")].filter(Boolean).join(" ") ||
  "your part details";

const buildLoadingUrl = ({ action, nextPath, sourceParams }) => {
  const loadingParams = new URLSearchParams({
    action,
    next: nextPath,
    query: getPrimaryRequestText(sourceParams),
  });

  return `loading.html?${loadingParams.toString()}`;
};

panelSwitches.forEach((switchButton) => {
  switchButton.addEventListener("click", (event) => {
    event.preventDefault();
    setActivePanel(switchButton.dataset.panelTarget);
  });
});

uploadBoxes.forEach((uploadBox) => {
  const fileInput = uploadBox.querySelector('input[type="file"]');
  const fileName = uploadBox.querySelector(".file-name");

  if (!fileInput || !fileName) return;

  const setFileName = (file) => {
    fileName.textContent = file ? `Selected: ${file.name}` : "";
  };

  fileInput.addEventListener("change", () => {
    setFileName(fileInput.files[0]);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadBox.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadBox.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadBox.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadBox.classList.remove("is-dragging");
    });
  });

  uploadBox.addEventListener("drop", (event) => {
    const droppedFile = event.dataTransfer.files[0];

    if (!droppedFile) return;

    fileInput.files = event.dataTransfer.files;
    setFileName(droppedFile);
  });
});

const setAiListingStatus = (message, isError = false) => {
  if (!aiListingStatuses.length) return;

  aiListingStatuses.forEach((status) => {
    status.textContent = message || "";
    status.classList.toggle("is-error", isError);
  });
};

const formatAiValue = (value, fallback = "-") => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

const titleCaseValue = (value) => {
  const text = formatAiValue(value);
  if (text === "-") return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("Could not read uploaded image.")));
    reader.readAsDataURL(file);
  });

const loadImageFromDataUrl = (dataUrl) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("Could not prepare uploaded image.")));
    image.src = dataUrl;
  });

const resizeImageForAi = async (file, maxSide = 1280, quality = 0.82) => {
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(originalDataUrl);
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return originalDataUrl;
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
};

const normaliseBoundingBox = (box) => {
  if (!box || typeof box !== "object") return null;

  const x = Math.max(0, Math.min(100, Number(box.x ?? box.left)));
  const y = Math.max(0, Math.min(100, Number(box.y ?? box.top)));
  const width = Math.max(0, Math.min(100, Number(box.width ?? box.w)));
  const height = Math.max(0, Math.min(100, Number(box.height ?? box.h)));
  const clippedWidth = Math.min(width, 100 - x);
  const clippedHeight = Math.min(height, 100 - y);

  if (![x, y, clippedWidth, clippedHeight].every(Number.isFinite) || clippedWidth <= 0 || clippedHeight <= 0) {
    return null;
  }

  return { x, y, width: clippedWidth, height: clippedHeight };
};

const createFocusedPartImage = async (imageUrl, box) => {
  const boundingBox = normaliseBoundingBox(box);

  if (!imageUrl || !boundingBox) return null;

  const image = await loadImageFromDataUrl(imageUrl);
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const sourceX = boundingBox.x / 100 * naturalWidth;
  const sourceY = boundingBox.y / 100 * naturalHeight;
  const sourceWidth = boundingBox.width / 100 * naturalWidth;
  const sourceHeight = boundingBox.height / 100 * naturalHeight;
  const padding = Math.max(sourceWidth, sourceHeight) * 0.22;
  const cropX = Math.max(0, sourceX - padding);
  const cropY = Math.max(0, sourceY - padding);
  const cropRight = Math.min(naturalWidth, sourceX + sourceWidth + padding);
  const cropBottom = Math.min(naturalHeight, sourceY + sourceHeight + padding);
  const cropWidth = cropRight - cropX;
  const cropHeight = cropBottom - cropY;

  if (cropWidth <= 0 || cropHeight <= 0) return null;

  const maxOutputSide = 640;
  const scale = Math.min(1, maxOutputSide / Math.max(cropWidth, cropHeight));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) return null;

  canvas.width = Math.max(1, Math.round(cropWidth * scale));
  canvas.height = Math.max(1, Math.round(cropHeight * scale));
  context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/jpeg", 0.86);
};

const setPartThumbnailImage = (thumbnail, imageUrl, boundingBox) => {
  if (!thumbnail || !imageUrl) return;

  thumbnail.style.backgroundImage = `linear-gradient(135deg, rgba(20, 107, 76, 0.1), rgba(39, 95, 143, 0.08)), url("${imageUrl}")`;
  thumbnail.style.backgroundPosition = "center";
  thumbnail.style.backgroundSize = "cover";
  thumbnail.classList.toggle("has-focused-image", Boolean(boundingBox));
};

const renderPartThumbnailImages = async (parts = [], imageUrl) => {
  if (!reviewedParts || !imageUrl) return;

  reviewedParts.querySelectorAll(".part-row").forEach((row) => {
    const partIndex = Number(row.dataset.aiPartIndex);
    const thumbnail = row.querySelector(".part-thumb");
    const part = parts[partIndex];
    const boundingBox = normaliseBoundingBox(part?.bounding_box);

    setPartThumbnailImage(thumbnail, imageUrl, boundingBox);
  });

  await Promise.all(
    parts.map(async (part, index) => {
      const thumbnail = reviewedParts.querySelector(`[data-ai-part-index="${index}"] .part-thumb`);

      try {
        const focusedImageUrl = await createFocusedPartImage(imageUrl, part.bounding_box);

        if (!focusedImageUrl) return;

        part.focused_image_url = focusedImageUrl;
        setPartThumbnailImage(thumbnail, focusedImageUrl, part.bounding_box);
      } catch {
        setPartThumbnailImage(thumbnail, imageUrl, normaliseBoundingBox(part.bounding_box));
      }
    })
  );
};

const dataUrlToBlob = (dataUrl) => {
  const [meta, base64Data] = dataUrl.split(",");
  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
};

const storeListingDraft = ({ pendingListing, data }) => {
  const draft = {
    createdAt: new Date().toISOString(),
    source: pendingListing.source,
    image: pendingListing.image,
    data,
  };

  sessionStorage.setItem(listingDraftStorageKey, JSON.stringify(draft));
  sessionStorage.removeItem(pendingListingStorageKey);
};

const createAnalysisFormData = (pendingListing) => {
  const formData = new FormData();
  const imageBlob = dataUrlToBlob(pendingListing.image.preview);
  const source = pendingListing.source || {};

  formData.append("image", imageBlob, pendingListing.image.name || "uploaded-part.jpg");
  formData.append("part_description", source.part || "");
  formData.append("part_number", source.partNumber || "");
  formData.append("vehicle_make", source.brand || "");
  formData.append("vehicle_model", source.model || "");
  formData.append("vin", source.vin || "");
  formData.append("colour", source.colour || "");
  formData.append("engine_size", source["engine-size"] || "");
  formData.append("location", source.location || "");

  return formData;
};

const appendSearchSourceToFormData = (formData, source = {}) => {
  formData.append("part", source.part || "");
  formData.append("plate", source.plate || "");
  formData.append("brand", source.brand || "");
  formData.append("model", source.model || "");
  formData.append("partNumber", source.partNumber || "");
  formData.append("vin", source.vin || "");
  formData.append("colour", source.colour || "");
  formData.append("engine_size", source["engine-size"] || source.engineSize || "");
  formData.append("location", source.location || "");
  formData.append("condition", source.condition || "");
};

const createSearchFormData = (pendingSearch) => {
  const formData = new FormData();
  const source = pendingSearch?.source || {};

  appendSearchSourceToFormData(formData, source);

  if (pendingSearch?.image?.preview) {
    const imageBlob = dataUrlToBlob(pendingSearch.image.preview);
    formData.append("image", imageBlob, pendingSearch.image.name || "search-part.jpg");
  }

  return formData;
};

const prepareListingAnalysis = async (form) => {
  const imageInput = form.querySelector('input[type="file"]');
  const image = imageInput?.files?.[0];
  const submitButton = form.querySelector('button[type="submit"]');

  if (!image) {
    setAiListingStatus("Upload a part image first so AI can analyse it.", true);
    return;
  }

  if (!image.type.startsWith("image/")) {
    setAiListingStatus("Please upload an image file.", true);
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Opening scanner...";
  }

  setAiListingStatus("Opening scanner...");

  try {
    const sourceParams = collectFormSearchParams(form);
    const pendingListing = {
      createdAt: new Date().toISOString(),
      source: Object.fromEntries(sourceParams.entries()),
      image: {
        name: image.name,
        type: "image/jpeg",
        originalType: image.type,
        size: image.size,
        preview: await resizeImageForAi(image),
      },
    };

    sessionStorage.setItem(pendingListingStorageKey, JSON.stringify(pendingListing));
    window.location.href = buildLoadingUrl({
      action: "list",
      nextPath: "result.html",
      sourceParams,
    });
  } catch (error) {
    setAiListingStatus(
      error.name === "QuotaExceededError"
        ? "That image is too large to pass through the loading page. Try a smaller photo."
        : error.message,
      true
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "List part";
    }
  }
};

const preparePartSearch = async (form) => {
  const imageInput = form.querySelector('input[type="file"]');
  const image = imageInput?.files?.[0];
  const submitButton = form.querySelector('button[type="submit"]');
  const sourceParams = collectFormSearchParams(form);

  if (image && !image.type.startsWith("image/")) {
    setAiListingStatus("Please upload an image file.", true);
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Searching...";
  }

  try {
    const pendingSearch = {
      createdAt: new Date().toISOString(),
      source: Object.fromEntries(sourceParams.entries()),
      image: image
        ? {
            name: image.name,
            type: "image/jpeg",
            originalType: image.type,
            size: image.size,
            preview: await resizeImageForAi(image),
          }
        : null,
    };
    const queryString = sourceParams.toString();
    const nextPath = queryString ? `search-results.html?${queryString}` : "search-results.html";

    sessionStorage.setItem(pendingSearchStorageKey, JSON.stringify(pendingSearch));
    sessionStorage.removeItem(searchResultsStorageKey);
    window.location.href = buildLoadingUrl({
      action: "search",
      nextPath,
      sourceParams,
    });
  } catch (error) {
    setAiListingStatus(
      error.name === "QuotaExceededError"
        ? "That image is too large to search through the loading page. Try a smaller photo."
        : error.message,
      true
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Search parts";
    }
  }
};

const getListingDraft = () => {
  try {
    return JSON.parse(sessionStorage.getItem(listingDraftStorageKey) || "null");
  } catch {
    return null;
  }
};

const getDraftListing = (draft) => draft?.data?.listing_draft || draft?.data || {};

const getDraftParts = (draft) => {
  const detectedParts = draft?.data?.detected_parts;
  const listing = getDraftListing(draft);
  const source = draft?.source || {};
  if (Array.isArray(detectedParts) && detectedParts.length) {
    return detectedParts.map((part) => ({
      make: listing.make,
      model: listing.model,
      year: listing.year,
      condition: listing.condition,
      part_number: listing.part_number,
      part_category: listing.category,
      colour: source.colour,
      engine_size: source["engine-size"],
      location: listing.location,
      ...part,
    }));
  }

  if (!Object.keys(listing).length) return [];

  return [
    {
      title: listing.title,
      part_type: draft?.data?.part_type,
      part_category: draft?.data?.part_category,
      make: listing.make,
      model: listing.model,
      year: listing.year,
      condition: listing.condition,
      colour: source.colour,
      engine_size: source["engine-size"],
      location: listing.location,
      part_number: draft?.data?.part_number,
      confidence: draft?.data?.confidence,
    },
  ];
};

const setResultFieldValue = (name, value) => {
  const field = resultForm?.elements[name];
  if (field) field.value = value || "";
};

const fillResultForm = (part = {}) => {
  setResultFieldValue("title", part.title);
  setResultFieldValue("partType", part.part_type || part.partType);
  setResultFieldValue("make", part.make);
  setResultFieldValue("model", part.model);
  setResultFieldValue("year", part.year || part.year_from || "");
  setResultFieldValue("condition", part.condition ? titleCaseValue(part.condition) : "");
  setResultFieldValue("partNumber", part.part_number);
  setResultFieldValue("category", part.part_category || part.category);
  setResultFieldValue("side", part.side);
  setResultFieldValue("colour", part.colour);
  setResultFieldValue("engineSize", part.engine_size || part.engineSize);
  setResultFieldValue("location", part.location);
};

const renderReviewedParts = (parts = []) => {
  if (!reviewedParts) return;

  if (!parts.length) {
    reviewedParts.innerHTML = '<p class="empty-results">No AI-reviewed parts were found. You can still complete the listing details manually.</p>';
    return;
  }

  reviewedParts.innerHTML = parts
    .map((part, index) => {
      const title = formatAiValue(part.title || part.part_type, "Detected part");
      const confidence = Number(part.confidence) || 0;
      const detailText = [
        part.part_category || part.category,
        part.side && `${part.side} side`,
        part.part_number && `Part no. ${part.part_number}`,
        confidence && `${confidence}% confidence`,
      ]
        .filter(Boolean)
        .join(" | ");

      return `
        <article class="part-row" data-ai-part-index="${index}">
          <div class="part-thumb" aria-hidden="true"></div>
          <div class="part-summary">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(detailText || "Potential sellable part from the uploaded image.")}</p>
          </div>
          <button class="row-action select-part" type="button">SELECT</button>
        </article>
      `;
    })
    .join("");
};

const renderUploadedPreview = (draft) => {
  if (uploadedPreview && draft?.image?.preview) {
    uploadedPreview.src = draft.image.preview;
    uploadedPreview.alt = draft.image.name ? `Uploaded preview for ${draft.image.name}` : "Uploaded car parts preview";
  }

  if (uploadedCount) {
    uploadedCount.textContent = draft?.image ? "1 image" : "No image";
  }

  if (photoMeta && draft?.image) {
    const sizeInMb = draft.image.size ? `${(draft.image.size / 1024 / 1024).toFixed(1)} MB` : "Image";
    photoMeta.innerHTML = [draft.image.type || "Image", sizeInMb, "AI reviewed"]
      .map((item) => `<span>${escapeHtml(item)}</span>`)
      .join("");
  }
};

const setResultStatus = (message, isError = false) => {
  if (!resultStatus) return;

  resultStatus.textContent = message || "";
  resultStatus.classList.toggle("is-error", isError);
};

const getCurrentListingPayload = () => {
  const draft = getListingDraft();
  const formData = new FormData(resultForm);

  return {
    title: String(formData.get("title") || "").trim(),
    make: String(formData.get("make") || "").trim(),
    model: String(formData.get("model") || "").trim(),
    year: String(formData.get("year") || "").trim(),
    condition: String(formData.get("condition") || "").trim(),
    part_type: String(formData.get("partType") || "").trim(),
    part_number: String(formData.get("partNumber") || "").trim(),
    category: String(formData.get("category") || "").trim(),
    side: String(formData.get("side") || "").trim(),
    colour: String(formData.get("colour") || draft?.source?.colour || "").trim(),
    engine_size: String(formData.get("engineSize") || draft?.source?.["engine-size"] || "").trim(),
    location: String(formData.get("location") || "").trim(),
    image_url: selectedResultPart?.focused_image_url || draft?.image?.preview || "",
  };
};

const publishCurrentListing = async () => {
  const payload = getCurrentListingPayload();

  if (!payload.title) {
    setResultStatus("Add a listing title before publishing.", true);
    resultForm.elements.title?.focus();
    return;
  }

  const submitButton = resultForm.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Publishing...";
  }

  setResultStatus("Saving listing...");

  try {
    const response = await fetch("/api/listings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.error || "Could not save listing.");
    }

    setResultStatus("Listing published.");
    window.setTimeout(() => {
      window.location.href = `search-results.html?part=${encodeURIComponent(payload.title)}`;
    }, 700);
  } catch (error) {
    setResultStatus(error.message, true);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Publish";
    }
  }
};

const initialiseResultPage = () => {
  if (!resultForm) return;

  const draft = getListingDraft();
  if (!draft) return;

  const listing = getDraftListing(draft);
  const parts = getDraftParts(draft);
  renderReviewedParts(parts);
  renderUploadedPreview(draft);
  renderPartThumbnailImages(parts, draft?.image?.preview);
  selectedResultPart = parts[0] || listing;
  fillResultForm(parts[0] || listing);

  reviewedParts?.addEventListener("click", (event) => {
    const button = event.target.closest(".select-part");
    if (!button) return;

    const selectedRow = button.closest(".part-row");
    const partIndex = Number(selectedRow?.dataset.aiPartIndex);
    const selectedPart = parts[partIndex];

    if (!selectedPart) return;

    selectedResultPart = selectedPart;

    document.querySelectorAll(".part-row").forEach((row) => {
      row.classList.toggle("is-selected", row === selectedRow);
    });

    fillResultForm(selectedPart);
    resultForm.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => resultForm.elements.title?.focus(), 420);
  });

  reviewedParts?.querySelector(".part-row")?.classList.add("is-selected");
};

panelForms.forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const sourceParams = collectFormSearchParams(form);

    if (form.dataset.panel === "find") {
      await preparePartSearch(form);
      return;
    }

    if (form.dataset.panel === "list") {
      await prepareListingAnalysis(form);
    }
  });
});

const normaliseSearchValue = (value) => String(value || "").trim().toLowerCase();

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const initialiseStaticResultPage = () => {
  if (!resultForm || !reviewedParts || getListingDraft()) return;

  reviewedParts.innerHTML = '<p class="empty-results">Upload a part image from the home page to generate listing rows.</p>';
};

if (resultForm) {
  initialiseResultPage();
  initialiseStaticResultPage();

  resultForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await publishCurrentListing();
  });
}

const getSearchFiltersFromForm = () => {
  if (!searchResultsForm) return {};

  const formData = new FormData(searchResultsForm);

  return {
    part: String(formData.get("part") || "").trim(),
    plate: String(formData.get("plate") || "").trim(),
    brand: String(formData.get("brand") || "").trim(),
    model: String(formData.get("model") || "").trim(),
    condition: String(formData.get("condition") || "").trim(),
    location: String(formData.get("location") || "").trim(),
    radius: String(formData.get("radius") || "national"),
    colour: String(formData.get("colour") || "").trim(),
    engineSize: String(formData.get("engineSize") || "").trim(),
    sortBy: String(formData.get("sortBy") || "bestMatch"),
  };
};

const listingMatchesFilters = (listing, filters) => {
  const searchableListingText = normaliseSearchValue(
    [
      listing.title,
      listing.partType,
      listing.category,
      listing.side,
      listing.partNumber,
      listing.make,
      listing.model,
      listing.year,
      listing.condition,
      listing.colour,
      listing.engineSize,
      listing.location,
    ].join(" ")
  );
  const searchTokens = normaliseSearchValue(filters.part).split(/\s+/).filter(Boolean);

  if (searchTokens.some((token) => !searchableListingText.includes(token))) {
    return false;
  }

  if (filters.brand && !normaliseSearchValue(listing.make).includes(normaliseSearchValue(filters.brand))) {
    return false;
  }

  if (filters.model && !normaliseSearchValue(listing.model).includes(normaliseSearchValue(filters.model))) {
    return false;
  }

  if (filters.condition && listing.condition !== filters.condition) {
    return false;
  }

  if (filters.location && !normaliseSearchValue(listing.location).includes(normaliseSearchValue(filters.location))) {
    return false;
  }

  if (filters.colour && !normaliseSearchValue(listing.colour).includes(normaliseSearchValue(filters.colour))) {
    return false;
  }

  if (filters.engineSize && normaliseSearchValue(listing.engineSize) !== normaliseSearchValue(filters.engineSize)) {
    return false;
  }

  return true;
};

const sortListings = (listings, sortBy) => {
  const sortedListings = [...listings];

  if (sortBy === "newest") {
    sortedListings.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  } else {
    sortedListings.sort((a, b) => (Number(b.matchRating) || 0) - (Number(a.matchRating) || 0));
  }

  return sortedListings;
};

const renderListingCard = (listing) => `
  <article class="listing-card" data-listing-id="${escapeHtml(listing.id)}">
    <img class="listing-image" src="${escapeHtml(listing.imageUrl || "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=520&q=80")}" alt="${escapeHtml(listing.title)}" />
    <div class="listing-content">
      <div class="listing-meta">
        ${[listing.condition, listing.year, listing.location].filter(Boolean).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
      <h3>${escapeHtml(listing.title)}</h3>
      ${listing.matchReason ? `<p>${escapeHtml(listing.matchReason)}</p>` : ""}
      <div class="listing-specs">
        ${[
          [listing.make, listing.model].filter(Boolean).join(" "),
          listing.partType || listing.category,
          listing.side && `${listing.side} side`,
          listing.partNumber && `Part no. ${listing.partNumber}`,
          listing.colour,
          listing.engineSize,
        ]
          .filter(Boolean)
          .map((item) => `<span>${escapeHtml(item)}</span>`)
          .join("")}
      </div>
    </div>
    <div class="listing-action-panel">
      ${
        listing.matchRating !== null && listing.matchRating !== undefined
          ? `<strong class="match-rating">${escapeHtml(listing.matchRating)}% match</strong>`
          : ""
      }
      <span>${escapeHtml(listing.postedAt ? new Date(listing.postedAt).toLocaleDateString("en-GB") : "Saved listing")}</span>
      <button class="row-action" type="button">View listing</button>
    </div>
  </article>
`;

const renderActiveFilters = (filters) => {
  if (!activeFilters) return;

  const filterLabels = [
    ["part", "Search"],
    ["brand", "Brand"],
    ["model", "Model"],
    ["condition", "Condition"],
    ["location", "Location"],
    ["radius", "Radius"],
    ["colour", "Colour"],
    ["engineSize", "Engine"],
  ];
  const chips = filterLabels
    .filter(([key]) => {
      if (key === "radius") return filters.radius && filters.radius !== "national";
      return Boolean(filters[key]);
    })
    .map(([key, label]) => {
      const radiusValue = key === "radius" ? `Within ${filters[key]} miles` : filters[key];

      return `<span class="filter-chip">${label}: ${escapeHtml(radiusValue)}</span>`;
    });

  if (aiSearchContext?.usedAi) {
    chips.unshift('<span class="filter-chip">AI match ranking</span>');
  }

  activeFilters.innerHTML = chips.join("");
};

const updateSearchResultsUrl = (filters) => {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (!value || key === "sortBy" && value === "bestMatch" || key === "radius" && value === "national") {
      return;
    }

    searchParams.set(key, value);
  });

  const queryString = searchParams.toString();
  const nextUrl = queryString ? `search-results.html?${queryString}` : "search-results.html";
  window.history.replaceState({}, "", nextUrl);
};

const getStoredSearchResults = () => {
  try {
    return JSON.parse(sessionStorage.getItem(searchResultsStorageKey) || "null");
  } catch {
    return null;
  }
};

const isFreshStoredSearch = (storedResults) => {
  const createdAt = storedResults?.createdAt ? new Date(storedResults.createdAt).getTime() : 0;
  return createdAt && Date.now() - createdAt < 10 * 60 * 1000;
};

const buildSearchSourceFromUrl = () => {
  const searchParams = new URLSearchParams(window.location.search);

  return {
    part: searchParams.get("part") || "",
    plate: searchParams.get("plate") || "",
    brand: searchParams.get("brand") || "",
    model: searchParams.get("model") || "",
    partNumber: searchParams.get("partNumber") || "",
    vin: searchParams.get("vin") || "",
    colour: searchParams.get("colour") || "",
    engineSize: searchParams.get("engineSize") || searchParams.get("engine-size") || "",
    location: searchParams.get("location") || "",
    condition: searchParams.get("condition") || "",
  };
};

const runSearchFromSource = async (source) => {
  const formData = new FormData();
  appendSearchSourceToFormData(formData, source);

  const response = await fetch("/api/search-listings", {
    method: "POST",
    body: formData,
  });
  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error || "Could not search listings.");
  }

  return json.data;
};

const loadSavedListings = async () => {
  const storedResults = getStoredSearchResults();

  if (storedResults?.data?.listings && isFreshStoredSearch(storedResults)) {
    aiSearchContext = storedResults.data;
    availablePartListings = Array.isArray(storedResults.data.listings) ? storedResults.data.listings : [];
    return;
  }

  aiSearchContext = await runSearchFromSource(buildSearchSourceFromUrl());
  availablePartListings = Array.isArray(aiSearchContext.listings) ? aiSearchContext.listings : [];
};

const renderSearchResults = () => {
  if (!searchResultsForm || !listingResults) return;

  const filters = getSearchFiltersFromForm();
  const matchingListings = sortListings(
    availablePartListings.filter((listing) => listingMatchesFilters(listing, filters)),
    filters.sortBy
  );
  const resultWord = matchingListings.length === 1 ? "result" : "results";
  const intentSummary = aiSearchContext?.searchIntent?.summary;

  listingResults.innerHTML = matchingListings.map(renderListingCard).join("");

  if (resultsCount) {
    resultsCount.textContent = `${matchingListings.length} ${resultWord}`;
  }

  if (resultsSummary) {
    resultsSummary.textContent = intentSummary
      ? `AI-ranked matches for ${intentSummary}.`
      : filters.part
        ? `AI-ranked matches for "${filters.part}".`
        : "Showing current listings ranked by match.";
  }

  if (emptyResults) {
    emptyResults.hidden = matchingListings.length > 0;
  }

  renderActiveFilters(filters);
  updateSearchResultsUrl(filters);
};

const populateSearchFormFromUrl = () => {
  if (!searchResultsForm) return;

  const searchParams = new URLSearchParams(window.location.search);
  const fieldAliases = {
    engineSize: ["engineSize", "engine-size"],
  };

  searchResultsForm.querySelectorAll("[data-search-field]").forEach((field) => {
    const aliases = fieldAliases[field.name] || [field.name];
    const urlValue = aliases.map((name) => searchParams.get(name)).find(Boolean);

    if (urlValue) {
      field.value = urlValue;
    }
  });
};

if (searchResultsForm) {
  populateSearchFormFromUrl();
  listingResults.innerHTML = '<p class="empty-results">Loading saved listings...</p>';
  loadSavedListings()
    .then(renderSearchResults)
    .catch((error) => {
      listingResults.innerHTML = `<p class="empty-results">${escapeHtml(error.message)}</p>`;
      if (resultsCount) resultsCount.textContent = "0 results";
      if (resultsSummary) resultsSummary.textContent = "Could not load saved listings.";
    });

  searchResultsForm.addEventListener("input", renderSearchResults);
  searchResultsForm.addEventListener("change", renderSearchResults);
  searchResultsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderSearchResults();
  });
}

if (clearSearchFiltersButton && searchResultsForm) {
  clearSearchFiltersButton.addEventListener("click", () => {
    ["condition", "location", "colour", "engineSize"].forEach((fieldName) => {
      const field = searchResultsForm.elements[fieldName];

      if (field) field.value = "";
    });

    searchResultsForm.elements.radius.value = "national";
    searchResultsForm.elements.sortBy.value = "bestMatch";
    renderSearchResults();
  });
}

const wait = (milliseconds) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

const getPendingListing = () => {
  try {
    return JSON.parse(sessionStorage.getItem(pendingListingStorageKey) || "null");
  } catch {
    return null;
  }
};

const getPendingSearch = () => {
  try {
    return JSON.parse(sessionStorage.getItem(pendingSearchStorageKey) || "null");
  } catch {
    return null;
  }
};

const analyzePendingListing = async () => {
  const pendingListing = getPendingListing();

  if (!pendingListing?.image?.preview) {
    throw new Error("No uploaded image was found. Please start the listing again.");
  }

  const response = await fetch("/api/analyze-part", {
    method: "POST",
    body: createAnalysisFormData(pendingListing),
  });
  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error || "AI analysis failed.");
  }

  storeListingDraft({ pendingListing, data: json.data });
};

const analyzePendingSearch = async () => {
  const pendingSearch = getPendingSearch();

  if (!pendingSearch) {
    return;
  }

  const response = await fetch("/api/search-listings", {
    method: "POST",
    body: createSearchFormData(pendingSearch),
  });
  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error || "AI search failed.");
  }

  sessionStorage.setItem(
    searchResultsStorageKey,
    JSON.stringify({
      createdAt: new Date().toISOString(),
      source: pendingSearch.source,
      hasImage: Boolean(pendingSearch.image),
      data: json.data,
    })
  );
  sessionStorage.removeItem(pendingSearchStorageKey);
};

const showLoadingError = (message) => {
  if (loadingEyebrow) loadingEyebrow.textContent = "Review needed";
  loadingTitle.textContent = "Could not analyse the upload";
  loadingMessage.textContent = message;
  loadingQuery.textContent = "Return to the listing form and try again.";
};

const configureLoadingPage = async () => {
  if (!loadingTitle || !loadingMessage || !loadingQuery) return;

  const loadingParams = new URLSearchParams(window.location.search);
  const action = loadingParams.get("action") || "search";
  const query = loadingParams.get("query") || "your part details";
  const nextPath = loadingParams.get("next") || "search-results.html";
  const loadingModes = {
    search: {
      eyebrow: "Matching inventory",
      title: "Finding the right parts",
      message: "Checking vehicle details, part descriptions, and compatible listings.",
    },
    list: {
      eyebrow: "Reading upload",
      title: "Preparing your listing",
      message: "Reviewing your part details and getting the listing workspace ready.",
    },
  };
  const mode = loadingModes[action] || loadingModes.search;

  if (loadingEyebrow) {
    loadingEyebrow.textContent = mode.eyebrow;
  }

  loadingTitle.textContent = mode.title;
  loadingMessage.textContent = mode.message;
  loadingQuery.textContent = query;

  try {
    if (action === "list") {
      await Promise.all([analyzePendingListing(), wait(1800)]);
    } else if (action === "search") {
      await Promise.all([analyzePendingSearch(), wait(1800)]);
    } else {
      await wait(1800);
    }

    window.location.href = nextPath;
  } catch (error) {
    showLoadingError(error.message);
  }
};

configureLoadingPage();
