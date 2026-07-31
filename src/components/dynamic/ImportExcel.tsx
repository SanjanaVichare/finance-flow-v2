import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet } from 'lucide-react';

interface ImportExcelProps {
    entityDefinitionId: string;
    fields: any[];
    onSuccess: () => void;
    onCancel: () => void;
}

export function ImportExcel({
    entityDefinitionId,
    fields,
    onSuccess,
    onCancel,
}: ImportExcelProps) {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    const handleImport = async () => {
        if (!file) {
            toast.error('Please select a file');
            return;
        }

        setLoading(true);
        try {
            // TODO: Implement Excel import
            toast.success('Import functionality coming soon!');
            onSuccess();
        } catch (error: any) {
            toast.error(error.message || 'Failed to import');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center relative">
                {file ? (
                    <div className="space-y-2">
                        <FileSpreadsheet className="h-12 w-12 mx-auto text-primary" />
                        <p className="font-medium">{file.name}</p>
                        <Button variant="outline" size="sm" onClick={() => setFile(null)}>
                            Change file
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                            Drop your Excel or CSV file here, or click to browse
                        </p>
                        <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onCancel} disabled={loading}>
                    Cancel
                </Button>
                <Button onClick={handleImport} disabled={!file || loading}>
                    {loading ? 'Importing...' : 'Import'}
                </Button>
            </div>
        </div>
    );
}