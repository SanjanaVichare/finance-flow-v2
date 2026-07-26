import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/employees")({
    component: EmployeesPage,
});

function EmployeesPage() {
    return <div>Employees</div>;
}