import { useParams, useNavigate } from "react-router-dom";
import { useProperty } from "../hooks/useProperty.ts";
import { useScenarios } from "../hooks/useScenarios.ts";
import { useAssumptions } from "../hooks/useAssumptions.ts";
import { useLTRAssumptions } from "../hooks/useLTRAssumptions.ts";
import { PropertyDetail } from "../components/PropertyDetail/PropertyDetail.tsx";

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
      <div className="flex items-center justify-center py-20">
        <div className="text-ink-3 text-[14px]">Loading property…</div>
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
