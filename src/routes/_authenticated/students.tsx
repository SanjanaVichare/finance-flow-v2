import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/students")({
    component: StudentsPage,
});

function StudentsPage() {
    return <div>Students</div>;
}