import { useSearchParams } from "react-router-dom";
import { ComparisonView } from "../components/Comparison/ComparisonView.tsx";

export function ComparePage() {
  const [searchParams] = useSearchParams();
  const idsParam = searchParams.get("ids") ?? "";
  const ids = idsParam.split(",").filter((id) => id.trim().length > 0);

  return <ComparisonView propertyIds={ids} />;
}
