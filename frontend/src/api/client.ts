import axios from "axios";
import type {
  Property,
  PropertySummary,
  MortgageScenario,
  STRAssumptions,
  LTRAssumptions,
  ComputedResults,
  LTRComputedResults,
  SensitivityData,
  LTRSensitivityData,
  AmortizationEntry,
  ComparisonProperty,
  ProjectionSummary,
  MonthlyDetail,
  QuickTestRequest,
  QuickTestResult,
} from "../types";

const api = axios.create({ baseURL: "/api" });

// Properties
export const listProperties = () => api.get<PropertySummary[]>("/properties").then((r) => r.data);
export const getProperty = (id: string) => api.get<Property>(`/properties/${id}`).then((r) => r.data);
export const createProperty = (data: Partial<Property>) => api.post<Property>("/properties", data).then((r) => r.data);
export const updateProperty = (id: string, data: Partial<Property>) => api.put<Property>(`/properties/${id}`, data).then((r) => r.data);
export const deleteProperty = (id: string) => api.delete(`/properties/${id}`);

// Scenarios
export const listScenarios = (propertyId: string) => api.get<MortgageScenario[]>(`/properties/${propertyId}/scenarios`).then((r) => r.data);
export const createScenario = (propertyId: string, data: Partial<MortgageScenario>) => api.post<MortgageScenario>(`/properties/${propertyId}/scenarios`, data).then((r) => r.data);
export const updateScenario = (propertyId: string, scenarioId: string, data: Partial<MortgageScenario>) => api.put<MortgageScenario>(`/properties/${propertyId}/scenarios/${scenarioId}`, data).then((r) => r.data);
export const deleteScenario = (propertyId: string, scenarioId: string) => api.delete(`/properties/${propertyId}/scenarios/${scenarioId}`);
export const duplicateScenario = (propertyId: string, scenarioId: string) => api.post<MortgageScenario>(`/properties/${propertyId}/scenarios/${scenarioId}/duplicate`).then((r) => r.data);
export const activateScenario = (propertyId: string, scenarioId: string) => api.put<MortgageScenario>(`/properties/${propertyId}/scenarios/${scenarioId}/activate`).then((r) => r.data);

// Assumptions
export const getAssumptions = (propertyId: string) => api.get<STRAssumptions>(`/properties/${propertyId}/assumptions`).then((r) => r.data);
export const updateAssumptions = (propertyId: string, data: Partial<STRAssumptions>) => api.put<STRAssumptions>(`/properties/${propertyId}/assumptions`, data).then((r) => r.data);

// LTR Assumptions
export const getLTRAssumptions = (propertyId: string) => api.get<LTRAssumptions>(`/properties/${propertyId}/ltr-assumptions`).then((r) => r.data);
export const updateLTRAssumptions = (propertyId: string, data: Partial<LTRAssumptions>) => api.put<LTRAssumptions>(`/properties/${propertyId}/ltr-assumptions`, data).then((r) => r.data);

// Compute
export const getResults = (propertyId: string) => api.get<ComputedResults>(`/properties/${propertyId}/results`).then((r) => r.data);
export const getResultsForScenario = (propertyId: string, scenarioId: string) => api.get<ComputedResults>(`/properties/${propertyId}/results/${scenarioId}`).then((r) => r.data);
export const getAmortization = (propertyId: string, scenarioId: string) => api.get<AmortizationEntry[]>(`/properties/${propertyId}/amortization/${scenarioId}`).then((r) => r.data);
export const getSensitivity = (propertyId: string) => api.get<SensitivityData>(`/properties/${propertyId}/sensitivity`).then((r) => r.data);
export const compareProperties = (ids: string[]) => api.get<ComparisonProperty[]>(`/compare?ids=${ids.join(",")}`).then((r) => r.data);
export const getProjections = (propertyId: string, scenarioId: string) => api.get<ProjectionSummary>(`/properties/${propertyId}/projections/${scenarioId}`).then((r) => r.data);
export const getMonthlyBreakdown = (propertyId: string, scenarioId: string) => api.get<{ property_id: string; scenario_id: string; use_seasonal: boolean; months: MonthlyDetail[] }>(`/properties/${propertyId}/monthly/${scenarioId}`).then((r) => r.data);

// LTR Compute
export const getLTRResults = (propertyId: string) => api.get<LTRComputedResults>(`/properties/${propertyId}/ltr-results`).then((r) => r.data);
export const getLTRSensitivity = (propertyId: string) => api.get<LTRSensitivityData>(`/properties/${propertyId}/ltr-sensitivity`).then((r) => r.data);

// Settings
export const getSettings = () => api.get("/settings").then((r) => r.data);
export const updateSettings = (data: Record<string, unknown>) => api.put("/settings", data).then((r) => r.data);

// Quick Test
export const quickTest = (data: QuickTestRequest) =>
  api.post<QuickTestResult>("/quick-test", data).then((r) => r.data);

// Scraper
export interface ScrapeResponse {
  property_id: string | null;
  scraper_result: {
    source: string;
    source_url: string;
    fields_found: string[];
    fields_missing: string[];
    scrape_succeeded: boolean;
    error_message: string | null;
  };
}

export const scrapeProperty = (url: string) =>
  api.post<ScrapeResponse>("/properties/scrape", { url }).then((r) => r.data);
