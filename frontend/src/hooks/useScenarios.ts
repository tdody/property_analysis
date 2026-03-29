import { useState, useEffect, useCallback } from "react";
import {
  listScenarios,
  createScenario as apiCreate,
  updateScenario as apiUpdate,
  deleteScenario as apiDelete,
  duplicateScenario as apiDuplicate,
  activateScenario as apiActivate,
} from "../api/client.ts";
import type { MortgageScenario } from "../types/index.ts";

export function useScenarios(propertyId: string) {
  const [scenarios, setScenarios] = useState<MortgageScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listScenarios(propertyId);
      setScenarios(data);
      setError(null);
    } catch {
      setError("Failed to load scenarios");
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const createScenario = useCallback(
    async (data: Partial<MortgageScenario>) => {
      const result = await apiCreate(propertyId, data);
      await fetch();
      return result;
    },
    [propertyId, fetch]
  );

  const updateScenario = useCallback(
    async (scenarioId: string, data: Partial<MortgageScenario>) => {
      const result = await apiUpdate(propertyId, scenarioId, data);
      await fetch();
      return result;
    },
    [propertyId, fetch]
  );

  const removeScenario = useCallback(
    async (scenarioId: string) => {
      await apiDelete(propertyId, scenarioId);
      await fetch();
    },
    [propertyId, fetch]
  );

  const duplicateScenario = useCallback(
    async (scenarioId: string) => {
      const result = await apiDuplicate(propertyId, scenarioId);
      await fetch();
      return result;
    },
    [propertyId, fetch]
  );

  const activateScenario = useCallback(
    async (scenarioId: string) => {
      await apiActivate(propertyId, scenarioId);
      await fetch();
    },
    [propertyId, fetch]
  );

  return {
    scenarios,
    loading,
    error,
    createScenario,
    updateScenario,
    removeScenario,
    duplicateScenario,
    activateScenario,
    refetch: fetch,
  };
}
