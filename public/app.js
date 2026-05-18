const panelSwitches = document.querySelectorAll("[data-panel-target]");
const panelTabs = document.querySelectorAll(".panel-tab");
const panelForms = document.querySelectorAll("[data-panel]");
const uploadBoxes = document.querySelectorAll(".upload-box");
const resultForm = document.querySelector(".result-form");
const selectPartButtons = document.querySelectorAll(".select-part");
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

const availablePartListings = [
  {
    id: "listing-001",
    title: "Ford Focus driver side headlight",
    description: "OEM halogen headlight with clear lens and intact mounting tabs.",
    partType: "headlight",
    make: "Ford",
    model: "Focus",
    year: "2018",
    condition: "Used",
    colour: "Blue",
    engineSize: "1.0L",
    location: "Birmingham",
    distanceMiles: 8,
    price: 120,
    sellerName: "Midlands Auto Parts",
    postedAt: "2026-05-17",
    imageUrl:
      "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=520&q=80",
  },
  {
    id: "listing-002",
    title: "Ford Focus front bumper in blue",
    description: "Used front bumper with grille section, ideal for Mk3.5 Focus repairs.",
    partType: "bumper",
    make: "Ford",
    model: "Focus",
    year: "2017",
    condition: "Used",
    colour: "Blue",
    engineSize: "1.6L",
    location: "Coventry",
    distanceMiles: 22,
    price: 95,
    sellerName: "Coventry Breakers",
    postedAt: "2026-05-15",
    imageUrl:
      "https://images.unsplash.com/photo-1532974297617-c0f05fe48bff?auto=format&fit=crop&w=520&q=80",
  },
  {
    id: "listing-003",
    title: "Ford Fiesta passenger side wing mirror",
    description: "Electric heated mirror, black casing, tested before removal.",
    partType: "wing mirror",
    make: "Ford",
    model: "Fiesta",
    year: "2016",
    condition: "Used",
    colour: "Black",
    engineSize: "1.2L",
    location: "Birmingham",
    distanceMiles: 5,
    price: 45,
    sellerName: "City Salvage",
    postedAt: "2026-05-14",
    imageUrl:
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=520&q=80",
  },
  {
    id: "listing-004",
    title: "Volkswagen Golf rear light cluster",
    description: "Refurbished rear lamp cluster for Golf, clean seals and connectors.",
    partType: "rear light",
    make: "Volkswagen",
    model: "Golf",
    year: "2019",
    condition: "Refurbished",
    colour: "Red",
    engineSize: "2.0L",
    location: "Wolverhampton",
    distanceMiles: 18,
    price: 80,
    sellerName: "West Mids German Parts",
    postedAt: "2026-05-12",
    imageUrl:
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=520&q=80",
  },
  {
    id: "listing-005",
    title: "BMW 3 Series bonnet panel",
    description: "Silver bonnet panel, minor storage marks, hinges not included.",
    partType: "bonnet",
    make: "BMW",
    model: "3 Series",
    year: "2020",
    condition: "Used",
    colour: "Silver",
    engineSize: "2.0L",
    location: "Leicester",
    distanceMiles: 42,
    price: 210,
    sellerName: "Prestige Spares",
    postedAt: "2026-05-10",
    imageUrl:
      "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=520&q=80",
  },
  {
    id: "listing-006",
    title: "Toyota Yaris front bumper new primer finish",
    description: "New pattern part supplied in primer, ready to paint and fit.",
    partType: "bumper",
    make: "Toyota",
    model: "Yaris",
    year: "2021",
    condition: "New",
    colour: "Grey",
    engineSize: "Hybrid",
    location: "Nottingham",
    distanceMiles: 58,
    price: 175,
    sellerName: "East Auto Supply",
    postedAt: "2026-05-09",
    imageUrl:
      "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=520&q=80",
  },
];

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

panelForms.forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const sourceParams = collectFormSearchParams(form);

    if (form.dataset.panel === "find") {
      const queryString = sourceParams.toString();
      const nextPath = queryString ? `search-results.html?${queryString}` : "search-results.html";

      window.location.href = buildLoadingUrl({
        action: "search",
        nextPath,
        sourceParams,
      });
      return;
    }

    if (form.dataset.panel === "list") {
      window.location.href = buildLoadingUrl({
        action: "list",
        nextPath: "result.html",
        sourceParams,
      });
    }
  });
});

if (resultForm) {
  const setResultField = (name, value) => {
    const field = resultForm.elements[name];

    if (!field) return;

    field.value = value || "";
  };

  selectPartButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const selectedRow = button.closest(".part-row");

      document.querySelectorAll(".part-row").forEach((row) => {
        row.classList.toggle("is-selected", row === selectedRow);
      });

      setResultField("title", button.dataset.title);
      setResultField("make", button.dataset.make);
      setResultField("model", button.dataset.model);
      setResultField("year", button.dataset.year);
      setResultField("condition", button.dataset.condition);
      setResultField("location", button.dataset.location);
      setResultField("price", button.dataset.price);
      setResultField("notes", button.dataset.notes);

      resultForm.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => resultForm.elements.title?.focus(), 420);
    });
  });

  resultForm.addEventListener("submit", (event) => {
    event.preventDefault();
  });
}

const normaliseSearchValue = (value) => String(value || "").trim().toLowerCase();

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const getSearchFiltersFromForm = () => {
  if (!searchResultsForm) return {};

  const formData = new FormData(searchResultsForm);

  return {
    part: String(formData.get("part") || "").trim(),
    plate: String(formData.get("plate") || "").trim(),
    brand: String(formData.get("brand") || "").trim(),
    model: String(formData.get("model") || "").trim(),
    condition: String(formData.get("condition") || "").trim(),
    maxPrice: Number(formData.get("maxPrice")) || null,
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
      listing.description,
      listing.partType,
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

  if (filters.maxPrice && listing.price > filters.maxPrice) {
    return false;
  }

  if (filters.location && !normaliseSearchValue(listing.location).includes(normaliseSearchValue(filters.location))) {
    return false;
  }

  if (filters.radius !== "national" && listing.distanceMiles > Number(filters.radius)) {
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

  if (sortBy === "priceLow") {
    sortedListings.sort((a, b) => a.price - b.price);
  } else if (sortBy === "priceHigh") {
    sortedListings.sort((a, b) => b.price - a.price);
  } else if (sortBy === "distance") {
    sortedListings.sort((a, b) => a.distanceMiles - b.distanceMiles);
  } else if (sortBy === "newest") {
    sortedListings.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  }

  return sortedListings;
};

const renderListingCard = (listing) => `
  <article class="listing-card" data-listing-id="${escapeHtml(listing.id)}">
    <img class="listing-image" src="${escapeHtml(listing.imageUrl)}" alt="${escapeHtml(listing.title)}" />
    <div class="listing-content">
      <div class="listing-meta">
        <span>${escapeHtml(listing.condition)}</span>
        <span>${escapeHtml(listing.year)}</span>
        <span>${escapeHtml(listing.location)}</span>
      </div>
      <h3>${escapeHtml(listing.title)}</h3>
      <p>${escapeHtml(listing.description)}</p>
      <div class="listing-specs">
        <span>${escapeHtml(listing.make)} ${escapeHtml(listing.model)}</span>
        <span>${escapeHtml(listing.colour)}</span>
        <span>${escapeHtml(listing.engineSize)}</span>
        <span>${escapeHtml(listing.sellerName)}</span>
      </div>
    </div>
    <div class="listing-price-panel">
      <strong>£${escapeHtml(listing.price)}</strong>
      <span>${escapeHtml(listing.distanceMiles)} miles away</span>
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
    ["maxPrice", "Max"],
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
      const value = key === "maxPrice" ? `£${filters[key]}` : filters[key];
      const radiusValue = key === "radius" ? `Within ${filters[key]} miles` : value;

      return `<span class="filter-chip">${label}: ${escapeHtml(radiusValue)}</span>`;
    });

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

const renderSearchResults = () => {
  if (!searchResultsForm || !listingResults) return;

  const filters = getSearchFiltersFromForm();
  const matchingListings = sortListings(
    availablePartListings.filter((listing) => listingMatchesFilters(listing, filters)),
    filters.sortBy
  );
  const resultWord = matchingListings.length === 1 ? "result" : "results";

  listingResults.innerHTML = matchingListings.map(renderListingCard).join("");

  if (resultsCount) {
    resultsCount.textContent = `${matchingListings.length} ${resultWord}`;
  }

  if (resultsSummary) {
    resultsSummary.textContent = filters.part
      ? `Showing matches for "${filters.part}".`
      : "Showing all available listings.";
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
  renderSearchResults();

  searchResultsForm.addEventListener("input", renderSearchResults);
  searchResultsForm.addEventListener("change", renderSearchResults);
  searchResultsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderSearchResults();
  });
}

if (clearSearchFiltersButton && searchResultsForm) {
  clearSearchFiltersButton.addEventListener("click", () => {
    ["condition", "maxPrice", "location", "colour", "engineSize"].forEach((fieldName) => {
      const field = searchResultsForm.elements[fieldName];

      if (field) field.value = "";
    });

    searchResultsForm.elements.radius.value = "national";
    searchResultsForm.elements.sortBy.value = "bestMatch";
    renderSearchResults();
  });
}

const configureLoadingPage = () => {
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

  window.setTimeout(() => {
    window.location.href = nextPath;
  }, 2400);
};

configureLoadingPage();
