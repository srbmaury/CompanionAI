import { useSearchParams } from "react-router-dom";
import AssessmentBuilderPage from "./AssessmentBuilderPage";
import AssessmentsPage from "./AssessmentsPage";

export default function HiringWorkspacePage() {
    const [searchParams] = useSearchParams();
    const isCreating = searchParams.get("create") === "1" && !searchParams.get("edit");
    return isCreating ? <AssessmentBuilderPage /> : <AssessmentsPage />;
}
