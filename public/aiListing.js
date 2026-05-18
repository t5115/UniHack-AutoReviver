const dropZone = document.getElementById("dropZone");
const dropInner = document.getElementById("dropInner");
const imageInput = document.getElementById("imageInput");
const browseBtn = document.getElementById("browseBtn");
const preview = document.getElementById("preview");
const analyzeBtn = document.getElementById("analyzeBtn");
const analyzeForm = document.getElementById("analyzeForm");
const resultSection = document.getElementById("resultSection");
const errorBox = document.getElementById("errorBox");

let selectedFile = null;

browseBtn.addEventListener("click", () => imageInput.click());
dropZone.addEventListener("click", (e) => {
  if (e.target !== browseBtn) imageInput.click();
});

imageInput.addEventListener("change", () => {
  if (imageInput.files[0]) setFile(imageInput.files[0]);
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) setFile(file);
});

function setFile(file) {
  selectedFile = file;
  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.classList.remove("hidden");
  dropInner.classList.add("hidden");
  dropZone.classList.add("has-image");
  analyzeBtn.disabled = false;
}

analyzeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selectedFile) return;

  setError(null);
  resultSection.classList.add("hidden");
  analyzeBtn.textContent = "Analysing…";
  analyzeBtn.classList.add("loading");
  analyzeBtn.disabled = true;

  const formData = new FormData();
  formData.append("image", selectedFile);
  const partNumber = document.getElementById("partNumber").value.trim();
  const donorReg = document.getElementById("donorReg").value.trim();
  if (partNumber) formData.append("part_number", partNumber);
  if (donorReg) formData.append("donor_reg", donorReg);

  try {
    const res = await fetch("/api/analyze-part", { method: "POST", body: formData });
    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.error || "Something went wrong");
    }

    renderResult(json.data);
  } catch (err) {
    setError(err.message);
  } finally {
    analyzeBtn.textContent = "Analyse Part";
    analyzeBtn.classList.remove("loading");
    analyzeBtn.disabled = false;
  }
});

function renderResult(data) {
  document.getElementById("resultTitle").textContent = data.title || "—";
  document.getElementById("resultDescription").textContent = data.description || "—";
  document.getElementById("resultCategory").textContent = data.part_category || "—";
  document.getElementById("resultPartType").textContent = data.part_type || "—";
  document.getElementById("resultSide").textContent = data.side || "N/A";
  document.getElementById("resultCondition").textContent =
    data.condition ? data.condition.charAt(0).toUpperCase() + data.condition.slice(1) : "—";
  document.getElementById("resultConditionNotes").textContent = data.condition_notes || "—";
  document.getElementById("resultPartNumber").textContent = data.part_number || "Not found";

  const badge = document.getElementById("confidenceBadge");
  const confidence = data.confidence || 0;
  badge.textContent = `${confidence}% confidence`;
  badge.className = "badge";
  if (confidence < 60) badge.classList.add("low");
  else if (confidence < 80) badge.classList.add("medium");

  const vehicleList = document.getElementById("vehicleList");
  vehicleList.innerHTML = "";
  if (data.suggested_vehicles && data.suggested_vehicles.length) {
    data.suggested_vehicles.forEach((v) => {
      const li = document.createElement("li");
      li.textContent = `${v.make} ${v.model} ${v.year_from}–${v.year_to}`;
      vehicleList.appendChild(li);
    });
  } else {
    vehicleList.innerHTML = "<li>None identified</li>";
  }

  resultSection.classList.remove("hidden");
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("resetBtn").addEventListener("click", () => {
  selectedFile = null;
  imageInput.value = "";
  preview.src = "";
  preview.classList.add("hidden");
  dropInner.classList.remove("hidden");
  dropZone.classList.remove("has-image");
  analyzeBtn.disabled = true;
  document.getElementById("partNumber").value = "";
  document.getElementById("donorReg").value = "";
  resultSection.classList.add("hidden");
  setError(null);
  window.scrollTo({ top: 0, behavior: "smooth" });
});

function setError(msg) {
  if (msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove("hidden");
  } else {
    errorBox.classList.add("hidden");
  }
}
