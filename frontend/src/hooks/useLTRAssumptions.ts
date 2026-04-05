import { useState, useEffect, useCallback } from "react";
import { getLTRAssumptions, updateLTRAssumptions as apiUpdate } from "../api/client.ts";
import type { LTRAssumptions } from "../types/index.ts";

export function useLTRAssumptions(propertyId: string) {
  const [ltrAssumptions, setLTRAssumptions] = useState<LTRAssumptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLTRAssumptions(propertyId);
      setLTRAssumptions(data);
      setError(null);
    } catch {
      setError("Failed to load LTR assumptions");
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const updateLTRAssumptions = useCallback(
    async (updates: Partial<LTRAssumptions>) => {
      try {
        const data = await apiUpdate(propertyId, updates);
        setLTRAssumptions(data);
        return data;
      } catch {
        setError("Failed to update LTR assumptions");
        throw new Error("Failed to update LTR assumptions");
      }
    },
    [propertyId]
  );

  return { ltrAssumptions, loading, error, updateLTRAssumptions, refetch: fetch };
}
