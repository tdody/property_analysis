import { useParams, useNavigate } from "react-router-dom";
import { useProperty } from "../hooks/useProperty.ts";
import { useScenarios } from "../hooks/useScenarios.ts";
import { useAssumptions } from "../hooks/useAssumptions.ts";
import { useLTRAssumptions } from "../hooks/useLTRAssumptions.ts";
import { PropertyDetail } from "../components/PropertyDetail/PropertyDetail.tsx";
import { Skeleton, SkeletonLine } from "../components/shared/Skeleton.tsx";

export function PropertyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    navigate("/");
    return null;
  }

  return <PropertyPageInner id={id} />;
}

function PropertyPageInner({ id }: { id: string }) {
  const { property, loading, error, updateProperty } = useProperty(id);
  const {
    scenarios,
    loading: scenariosLoading,
    createScenario,
    updateScenario,
    removeScenario,
    duplicateScenario,
    activateScenario,
  } = useScenarios(id);
  const {
    assumptions,
    loading: assumptionsLoading,
    updateAssumptions,
  } = useAssumptions(id);
  const {
    ltrAssumptions,
    loading: ltrLoading,
    updateLTRAssumptions,
  } = useLTRAssumptions(id);

  if (loading) {
    return (
      <div className="space-y-8" role="status" aria-label="Loading property">
        <SkeletonLine className="w-32" />
        <div className="flex items-end justify-between">
          <div className="space-y-3">
            <SkeletonLine className="w-20" />
            <Skeleton className="h-14 w-96" />
            <SkeletonLine className="w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-36 rounded-full" />
          </div>
        </div>
        <div className="border-y border-rule-strong py-6 grid grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`px-6 space-y-2 ${i > 0 ? "border-l border-rule" : ""}`}>
              <SkeletonLine className="w-28" />
              <Skeleton className="h-8 w-32" />
            </div>
          ))}
        </div>
        <div className="border-b border-rule-strong flex gap-8 pb-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonLine key={i} className="w-24" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="text-center py-20">
        <p className="text-negative mb-4">{error || "Property not found"}</p>
      </div>
    );
  }

  return (
    <PropertyDetail
      property={property}
      onUpdateProperty={updateProperty}
      scenarios={scenarios}
      scenariosLoading={scenariosLoading}
      onCreateScenario={createScenario}
      onUpdateScenario={updateScenario}
      onDeleteScenario={removeScenario}
      onDuplicateScenario={duplicateScenario}
      onActivateScenario={activateScenario}
      assumptions={assumptions}
      assumptionsLoading={assumptionsLoading}
      onUpdateAssumptions={updateAssumptions}
      ltrAssumptions={ltrAssumptions}
      ltrLoading={ltrLoading}
      onUpdateLTRAssumptions={updateLTRAssumptions}
    />
  );
}
