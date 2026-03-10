import type {
  AlternativesOut,
  ApplyResearchResponse,
  CompareOut,
  DataSourcesResponse,
  DeltaAnalysis,
  DocumentBrief,
  DocumentOut,
  ExtractionStatusResponse,
  MarketResearchResponse,
  MissingFields,
  ParameterSensitivity,
  Project,
  ProjectDetail,
  ResearchPreviewResponse,
  SimulationBrief,
  SimulationDetail,
} from '../types';
import request from './client';

// --- Projects ---
export const getProjects = () => request<Project[]>('/projects');
export const getProject = (id: string) => request<ProjectDetail>(`/projects/${id}`);
export const createProject = (name: string) =>
  request<Project>('/projects', { method: 'POST', body: JSON.stringify({ name }) });
export const updateProject = (id: string, name: string) =>
  request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });
export const deleteProject = (id: string) =>
  request<void>(`/projects/${id}`, { method: 'DELETE' });

// --- Simulations ---
export const getProjectSimulations = (projectId: string) =>
  request<SimulationBrief[]>(`/projects/${projectId}/simulations`);
export const createSimulation = (projectId: string, versionName: string) =>
  request<SimulationDetail>(`/projects/${projectId}/simulations`, {
    method: 'POST',
    body: JSON.stringify({ version_name: versionName }),
  });
export const getSimulation = (id: string) =>
  request<SimulationDetail>(`/simulations/${id}`);
export const updateSimulation = (id: string, data: Record<string, unknown>) =>
  request<SimulationDetail>(`/simulations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
export const cloneSimulation = (id: string) =>
  request<SimulationDetail>(`/simulations/${id}/clone`, { method: 'POST' });
export const approveSimulation = (id: string) =>
  request<SimulationDetail>(`/simulations/${id}/approve`, { method: 'PUT' });
export const calculateSimulation = (id: string) =>
  request<SimulationDetail>(`/simulations/${id}/calculate`, { method: 'POST' });
export const compareSimulations = (id1: string, id2: string) =>
  request<CompareOut>(`/simulations/${id1}/compare/${id2}`);

// --- Documents ---
export const uploadDocument = (projectId: string, file: File, documentType: string) => {
  const formData = new FormData();
  formData.append('project_id', projectId);
  formData.append('document_type', documentType);
  formData.append('file', file);
  return fetch('/api/documents/upload', { method: 'POST', body: formData }).then(
    async (res) => {
      if (!res.ok) {
        let detail: string = res.statusText;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const err = await res.json();
          detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
        } else {
          detail = (await res.text()) || res.statusText;
        }
        throw new Error(detail);
      }
      return res.json() as Promise<DocumentOut>;
    },
  );
};

export const getProjectDocuments = (projectId: string) =>
  request<DocumentBrief[]>(`/documents/by-project/${projectId}`);

// --- Reports ---
export const downloadReport = async (simId: string, type: 'management' | 'economic') => {
  const res = await fetch(`/api/simulations/${simId}/report/${type}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === 'string' ? err.detail : `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const disposition = res.headers.get('content-disposition');
  const match = disposition?.match(/filename="?(.+?)"?$/);
  a.download = match?.[1] ?? `${type}_report.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const getCalculationDetails = (simId: string) =>
  request<Record<string, unknown>>(`/simulations/${simId}/calculation-details`);

// --- Validation ---
export const getValidation = (simId: string) =>
  request<{
    ready: boolean;
    missing_planning: string[];
    missing_cost: string[];
    missing_revenue: string[];
    missing_mix: boolean;
    warnings: string[];
  }>(`/simulations/${simId}/validation`);

// --- Delta & Sensitivity ---
export const getDeltaAnalysis = (simId: string) =>
  request<DeltaAnalysis>(`/simulations/${simId}/delta`);
export const getParameterSensitivity = (simId: string) =>
  request<ParameterSensitivity>(`/simulations/${simId}/sensitivity`);

// --- Extraction Status ---
export const getExtractionStatus = (projectId: string) =>
  request<ExtractionStatusResponse>(`/projects/${projectId}/extraction-status`);

// --- Agent Pipeline ---
export const runPipeline = (simId: string) =>
  request<{ status: string; simulation_id: string }>(`/simulations/${simId}/run-pipeline`, { method: 'POST' });
export const getAgentStatus = (simId: string) =>
  request<Record<string, unknown>>(`/simulations/${simId}/agent-status`);
export const getMissingFields = (simId: string) =>
  request<MissingFields>(`/simulations/${simId}/missing-fields`);
export const getAlternatives = (simId: string) =>
  request<AlternativesOut>(`/simulations/${simId}/alternatives`);
export const getDataSources = (simId: string) =>
  request<DataSourcesResponse>(`/simulations/${simId}/data-sources`);

// --- Documents by Simulation ---
export const getSimulationDocuments = (simId: string) =>
  request<DocumentBrief[]>(`/documents/by-simulation/${simId}`);

// --- Market Research ---
export const triggerResearch = (projectId: string, force?: boolean) =>
  request<{ status: string; message: string }>(`/projects/${projectId}/research${force ? '?force=true' : ''}`, { method: 'POST' });
export const getResearch = (projectId: string) =>
  request<MarketResearchResponse>(`/projects/${projectId}/research`);
export const previewResearch = (projectId: string, simulationId: string) =>
  request<ResearchPreviewResponse>(
    `/projects/${projectId}/research/preview/${simulationId}`,
  );
export const applyResearch = (projectId: string, simulationId: string, overrides?: Record<string, number>, overwrite?: boolean) =>
  request<ApplyResearchResponse>(
    `/projects/${projectId}/simulations/${simulationId}/apply-research${overwrite ? '?overwrite=true' : ''}`,
    {
      method: 'POST',
      body: JSON.stringify(overrides ?? {}),
    },
  );

// --- Upload to Simulation ---
export const uploadDocumentToSimulation = (
  projectId: string,
  simulationId: string,
  file: File,
  documentType: string,
) => {
  const formData = new FormData();
  formData.append('project_id', projectId);
  formData.append('document_type', documentType);
  formData.append('simulation_id', simulationId);
  formData.append('file', file);
  return fetch('/api/documents/upload', { method: 'POST', body: formData }).then(
    async (res) => {
      if (!res.ok) {
        let detail: string = res.statusText;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const err = await res.json();
          detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
        } else {
          detail = (await res.text()) || res.statusText;
        }
        throw new Error(detail);
      }
      return res.json() as Promise<DocumentOut>;
    },
  );
};
