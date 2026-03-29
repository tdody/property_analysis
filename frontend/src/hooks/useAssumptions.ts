import { useState, useEffect, useCallback } from "react";
import { getAssumptions, updateAssumptions as apiUpdate } from "../api/client.ts";
import type { STRAssumptions } from "../types/index.ts";

export function useAssumptions(propertyId: string) {
  const [assumptions, setAssumptions] = useState<STRAssumptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAssumptions(propertyId);
      setAssumptions(data);
      setError(null);
    } catch {
      setError("Failed to load assumptions");
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const updateAssumptions = useCallback(
    async (updates: Partial<STRAssumptions>) => {
      try {
        const data = await apiUpdate(propertyId, updates);
        setAssumptions(data);
        return data;
      } catch {
        setError("Failed to update assumptions");
        throw new Error("Failed to update assumptions");
      }
    },
    [propertyId]
  );

  return { assumptions, loading, error, updateAssumptions, refetch: fetch };
}
