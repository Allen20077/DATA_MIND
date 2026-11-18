
import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
});

export async function checkBackend() {
  const response = await api.get("/api/health");
  return response.data;
}

export async function askAgent(question, datasetContext = null) {
  const response = await api.post("/api/chat", {
    question,
    dataset_context: datasetContext,
  });

  return response.data;
}

export async function uploadDataset(file) {
  const formData = new FormData();
  formData.append("file", file);

  const baseURL =
    import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  const response = await fetch(`${baseURL}/api/upload`, {
    method: "POST",
    body: formData,
  });

  const responseText = await response.text();

  let result;

  try {
    result = responseText ? JSON.parse(responseText) : null;
  } catch {
    throw new Error(
      `Backend returned invalid JSON. HTTP status: ${response.status}. Response: ${responseText.slice(0, 500)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      result?.detail || `Upload failed. HTTP ${response.status}`
    );
  }

  if (!result) {
    throw new Error("Backend returned an empty upload response.");
  }

  return result;
}

export async function getDatasetAnalysis(datasetId) {
  const response = await api.get(`/api/datasets/${datasetId}/analysis`);
  return response.data;
}

export async function analyzeDocument(file) {
  const formData = new FormData();
  formData.append("file", file);

  const baseURL =
    import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  const response = await fetch(
    `${baseURL}/api/documents/analyze`,
    {
      method: "POST",
      body: formData,
    }
  );

  const responseText = await response.text();

  let result;

  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Invalid server response: ${responseText.slice(0, 300)}`
    );
  }

  if (!response.ok) {
    throw new Error(result.detail || "Analysis failed.");
  }

  return result;
}

export default api;
