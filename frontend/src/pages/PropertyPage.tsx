import { useParams, useNavigate } from "react-router-dom";
import { useProperty } from "../hooks/useProperty.ts";
import { useScenarios } from "../hooks/useScenarios.ts";
import { useAssumptions } from "../hooks/useAssumptions.ts";
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500 text-lg">Loading property...</div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">{error || "Property not found"}</p>
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
    />
  );
}
