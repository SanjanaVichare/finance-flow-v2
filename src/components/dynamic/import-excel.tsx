import { useRef, useState } from "react";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload } from "lucide-react";

interface ImportExcelProps<T = any> {
    onImport: (rows: T[]) => Promise<void> | void;
    acceptedColumns?: string[];
    buttonText?: string;
}

export default function ImportExcel<T = any>({
    onImport,
    acceptedColumns = [],
    buttonText = "Import Excel",
}: ImportExcelProps<T>) {
    const inputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(false);

    async function handleFile(file: File) {
        try {
            setLoading(true);

            const buffer = await file.arrayBuffer();

            const workbook = XLSX.read(buffer, {
                type: "array",
            });

            const sheetName = workbook.SheetNames[0];

            const worksheet = workbook.Sheets[sheetName];

            const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
                defval: "",
            });

            if (!rows.length) {
                toast.error("Excel file is empty.");
                return;
            }

            if (acceptedColumns.length) {
                const headers = Object.keys(rows[0]);

                const missing = acceptedColumns.filter(
                    (c) => !headers.includes(c)
                );

                if (missing.length) {
                    toast.error(
                        `Missing columns: ${missing.join(", ")}`
                    );
                    return;
                }
            }

            await onImport(rows as T[]);

            toast.success(`${rows.length} rows imported successfully.`);
        } catch (err) {
            console.error(err);
            toast.error("Failed to import Excel file.");
        } finally {
            setLoading(false);

            if (inputRef.current) {
                inputRef.current.value = "";
            }
        }
    }

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                hidden
                onChange={(e) => {
                    const file = e.target.files?.[0];

                    if (!file) return;

                    handleFile(file);
                }}
            />

            <Button
                variant="outline"
                disabled={loading}
                onClick={() => inputRef.current?.click()}
            >
                <Upload className="mr-2 h-4 w-4" />

                {loading ? "Importing..." : buttonText}
            </Button>
        </>
    );
}