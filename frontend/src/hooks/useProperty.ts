import { useState, useEffect, useCallback } from "react";
import { getProperty, updateProperty as apiUpdateProperty } from "../api/client.ts";
import type { Property } from "../types/index.ts";

export function useProperty(id: string) {
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getProperty(id);
      setProperty(data);
      setError(null);
    } catch {
      setError("Failed to load property");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const updateProperty = useCallback(
    async (updates: Partial<Property>) => {
      try {
        const data = await apiUpdateProperty(id, updates);
        setProperty(data);
        return data;
      } catch {
        setError("Failed to update property");
        throw new Error("Failed to update property");
      }
    },
    [id]
  );

  return { property, loading, error, updateProperty, refetch: fetch };
}
