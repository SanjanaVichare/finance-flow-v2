// src/components/dynamic/ImportExport.tsx
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';

interface FieldDefinition {
    id: string;
    name: string;
    field_key: string;
    field_type: string;
    is_required: boolean;
    options: string[] | null;
}

interface ImportExportProps {
    entityDefinitionId: string;
    entityName: string;
    fields: FieldDefinition[];
    onSuccess: () => void;
}

export function ImportExport({
    entityDefinitionId,
    entityName,
    fields,
    onSuccess
}: ImportExportProps) {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [fileName, setFileName] = useState('');
    const [skipDuplicates, setSkipDuplicates] = useState(true);
    const [idField, setIdField] = useState<string>('');

    // Helper: Get user's company ID
    const getCompanyId = async () => {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error('Not authenticated');

        const { data: memberData } = await supabase
            .from('company_members')
            .select('company_id')
            .eq('user_id', userData.user.id)
            .single();

        if (!memberData) throw new Error('No company found');
        return memberData.company_id;
    };

    // ============ EXPORT FUNCTIONS ============

    const handleExport = async (format: 'xlsx' | 'csv') => {
        setLoading(true);
        setError(null);
        setProgress(10);

        try {
            const companyId = await getCompanyId();

            // Fetch all records
            const { data: records, error: fetchError } = await supabase
                .from('entities')
                .select('*')
                .eq('entity_definition_id', entityDefinitionId)
                .eq('company_id', companyId);

            if (fetchError) throw fetchError;

            setProgress(50);

            // Prepare data for export
            const exportData = records?.map((record) => {
                const row: Record<string, any> = {};

                // Add standard fields
                row['ID'] = record.id;
                row['Name'] = record.name;
                row['Created At'] = record.created_at;

                // Add dynamic fields
                fields.forEach((field) => {
                    const metadata = record.metadata as Record<string, any> || {};
                    const value = metadata[field.field_key];
                    if (value !== undefined && value !== null) {
                        if (field.field_type === 'date') {
                            row[field.name] = new Date(value).toLocaleDateString();
                        } else if (field.field_type === 'currency') {
                            row[field.name] = Number(value).toFixed(2);
                        } else if (field.field_type === 'boolean') {
                            row[field.name] = value ? 'Yes' : 'No';
                        } else {
                            row[field.name] = String(value);
                        }
                    } else {
                        row[field.name] = '';
                    }
                });

                return row;
            }) || [];

            setProgress(80);

            // Create workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exportData);

            // Auto-size columns
            const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
                wch: Math.max(key.length, 15),
            }));
            ws['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(wb, ws, entityName);

            // Generate filename
            const dateStr = new Date().toISOString().split('T')[0];
            const filename = `${entityName}_${dateStr}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;

            // Download
            const wbout = XLSX.write(wb, {
                bookType: format === 'xlsx' ? 'xlsx' : 'csv',
                type: 'array'
            });
            const blob = new Blob([wbout], {
                type: format === 'xlsx'
                    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    : 'text/csv'
            });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setProgress(100);
            toast.success(`Exported ${exportData.length} records to ${filename}`);

            // Log export
            await supabase.from('import_export_history').insert({
                company_id: companyId,
                operation: 'export',
                entity_definition_id: entityDefinitionId,
                file_name: filename,
                rows_processed: exportData.length,
                status: 'success',
            });

            setTimeout(() => setOpen(false), 1000);
        } catch (err: any) {
            setError(err.message || 'Failed to export');
            toast.error(err.message || 'Failed to export');
        } finally {
            setLoading(false);
            setProgress(0);
        }
    };

    // ============ EXPORT TEMPLATE ============

    const handleExportTemplate = () => {
        setLoading(true);
        setError(null);

        try {
            // Create template with column headers
            const templateData: Record<string, any> = {};
            fields.forEach((field) => {
                if (field.field_type === 'date') {
                    templateData[field.name] = '2024-01-15';
                } else if (field.field_type === 'currency' || field.field_type === 'number') {
                    templateData[field.name] = 1000;
                } else if (field.field_type === 'boolean') {
                    templateData[field.name] = 'Yes';
                } else if (field.field_type === 'dropdown' && field.options?.length) {
                    templateData[field.name] = field.options[0];
                } else {
                    templateData[field.name] = `Example ${field.name}`;
                }
            });

            // Add a second row with instructions
            const templateRows = [
                templateData,
                ...fields.map((field) => ({
                    [field.name]: field.is_required ? '(Required)' : '(Optional)'
                }))
            ];

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(templateRows);

            // Auto-size columns
            const colWidths = Object.keys(templateData).map((key) => ({
                wch: Math.max(key.length, 20),
            }));
            ws['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(wb, ws, 'Template');

            const filename = `${entityName}_Template.xlsx`;
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success('Template downloaded! Fill it with your data and import.');
        } catch (err: any) {
            setError(err.message || 'Failed to export template');
            toast.error(err.message || 'Failed to export template');
        } finally {
            setLoading(false);
        }
    };

    // ============ IMPORT FUNCTIONS ============

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv',
        ];

        if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx|xls|csv)$/)) {
            setError('Please upload an Excel file (.xlsx, .xls) or CSV file');
            return;
        }

        setFile(selectedFile);
        setFileName(selectedFile.name);
        setError(null);
        setSuccess(null);
        setColumnMapping({});
        setPreviewData([]);

        // Read and preview the file
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows: any[] = XLSX.utils.sheet_to_json(firstSheet);

                setPreviewData(rows.slice(0, 5));

                // Auto-map columns
                if (rows.length > 0) {
                    const headers = Object.keys(rows[0]);
                    const mapping: Record<string, string> = {};

                    headers.forEach((header) => {
                        const matchedField = fields.find(
                            (f) => f.name.toLowerCase() === header.trim().toLowerCase()
                        );
                        if (matchedField) {
                            mapping[header] = matchedField.field_key;
                        } else {
                            mapping[header] = 'skip';
                        }
                    });

                    setColumnMapping(mapping);
                }
            } catch (err) {
                setError('Failed to read file. Please make sure it\'s a valid Excel file.');
            }
        };
        reader.readAsArrayBuffer(selectedFile);
    };

    const handleImport = async () => {
        if (!file) {
            toast.error('Please select a file');
            return;
        }

        setLoading(true);
        setProgress(10);
        setError(null);

        try {
            const companyId = await getCompanyId();

            // Read file
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows: any[] = XLSX.utils.sheet_to_json(firstSheet);

            if (rows.length === 0) {
                throw new Error('The file is empty');
            }

            setProgress(30);

            // Check for required fields
            const requiredFields = fields.filter((f) => f.is_required);
            const mappedFields = Object.values(columnMapping).filter((v) => v !== 'skip');

            const missingRequired = requiredFields.filter(
                (f) => !mappedFields.includes(f.field_key)
            );

            if (missingRequired.length > 0) {
                throw new Error(`Missing required columns: ${missingRequired.map(f => f.name).join(', ')}`);
            }

            setProgress(50);

            // Fetch existing records to check for duplicates
            const { data: existingRecords, error: fetchError } = await supabase
                .from('entities')
                .select('id, name, metadata')
                .eq('entity_definition_id', entityDefinitionId)
                .eq('company_id', companyId);

            if (fetchError) throw fetchError;

            // Create a set of existing unique identifiers
            const existingNames = new Set();
            const existingEmails = new Set();
            const existingPhones = new Set();
            const existingMetadataKeys = new Set();

            existingRecords?.forEach((record) => {
                existingNames.add(record.name?.toLowerCase().trim());
                const metadata = record.metadata as Record<string, any> || {};

                if (metadata.email) {
                    existingEmails.add(metadata.email.toLowerCase().trim());
                }
                if (metadata.phone) {
                    existingPhones.add(metadata.phone.toLowerCase().trim());
                }

                // Create a unique key from metadata for comparison
                const metadataKey = Object.keys(metadata)
                    .sort()
                    .filter(key => metadata[key] !== undefined && metadata[key] !== null && metadata[key] !== '')
                    .map(key => `${key}:${String(metadata[key] || '').toLowerCase().trim()}`)
                    .join('|');
                if (metadataKey) {
                    existingMetadataKeys.add(metadataKey);
                }
            });

            setProgress(60);

            // Process rows with deduplication
            let successCount = 0;
            let duplicateCount = 0;
            let errorCount = 0;
            const newRecords: any[] = [];

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const metadata: Record<string, any> = {};

                // Map columns to metadata
                for (const [header, fieldKey] of Object.entries(columnMapping)) {
                    if (fieldKey === 'skip') continue;

                    let value = row[header];
                    const field = fields.find((f) => f.field_key === fieldKey);
                    if (!field) continue;

                    if (value !== undefined && value !== null && value !== '') {
                        switch (field.field_type) {
                            case 'number':
                                metadata[fieldKey] = parseFloat(String(value)) || 0;
                                break;
                            case 'currency':
                                metadata[fieldKey] = parseFloat(String(value).replace(/[₹,]/g, '')) || 0;
                                break;
                            case 'date':
                                if (typeof value === 'number') {
                                    const date = new Date((value - 25569) * 86400 * 1000);
                                    metadata[fieldKey] = date.toISOString();
                                } else {
                                    metadata[fieldKey] = new Date(value).toISOString();
                                }
                                break;
                            case 'boolean':
                                metadata[fieldKey] = Boolean(value) && value !== 'false' && value !== 'no';
                                break;
                            case 'dropdown':
                            case 'multi_select':
                                metadata[fieldKey] = String(value);
                                break;
                            default:
                                metadata[fieldKey] = String(value).trim();
                        }
                    }
                }

                // Get name from metadata or use fallback
                const name = metadata.full_name || metadata.name || `Record ${i + 1}`;

                // Check for duplicates (only if skipDuplicates is enabled)
                let isDuplicate = false;
                if (skipDuplicates) {
                    // Check by name
                    if (metadata.full_name || metadata.name) {
                        const nameLower = name.toLowerCase().trim();
                        if (existingNames.has(nameLower)) {
                            isDuplicate = true;
                        }
                    }

                    // Check by email
                    if (!isDuplicate && metadata.email) {
                        const emailLower = metadata.email.toLowerCase().trim();
                        if (existingEmails.has(emailLower)) {
                            isDuplicate = true;
                        }
                    }

                    // Check by phone
                    if (!isDuplicate && metadata.phone) {
                        const phoneLower = metadata.phone.toLowerCase().trim();
                        if (existingPhones.has(phoneLower)) {
                            isDuplicate = true;
                        }
                    }

                    // Check by metadata combination
                    if (!isDuplicate) {
                        const metadataKey = Object.keys(metadata)
                            .sort()
                            .filter(key => metadata[key] !== undefined && metadata[key] !== null && metadata[key] !== '')
                            .map(key => `${key}:${String(metadata[key]).toLowerCase().trim()}`)
                            .join('|');
                        if (metadataKey && existingMetadataKeys.has(metadataKey)) {
                            isDuplicate = true;
                        }
                    }

                    // Check by ID field if specified
                    if (!isDuplicate && idField && metadata[idField]) {
                        const idValue = String(metadata[idField]).toLowerCase().trim();
                        for (const record of existingRecords || []) {
                            const recordMetadata = record.metadata as Record<string, any> || {};
                            if (String(recordMetadata[idField] || '').toLowerCase().trim() === idValue) {
                                isDuplicate = true;
                                break;
                            }
                        }
                    }
                }

                if (isDuplicate) {
                    duplicateCount++;
                    continue;
                }

                // Add to existing sets to prevent duplicates within the same import
                if (metadata.full_name || metadata.name) {
                    existingNames.add(name.toLowerCase().trim());
                }
                if (metadata.email) {
                    existingEmails.add(metadata.email.toLowerCase().trim());
                }
                if (metadata.phone) {
                    existingPhones.add(metadata.phone.toLowerCase().trim());
                }

                newRecords.push({
                    entity_definition_id: entityDefinitionId,
                    company_id: companyId,
                    name: name,
                    type: 'employee',
                    metadata: metadata,
                    created_by: (await supabase.auth.getUser()).data.user?.id,
                });
            }

            setProgress(80);

            // Insert new records in batches
            if (newRecords.length > 0) {
                const { error: insertError } = await supabase
                    .from('entities')
                    .insert(newRecords);

                if (insertError) throw insertError;
                successCount = newRecords.length;
            }

            setProgress(100);

            // Log import
            await supabase.from('import_export_history').insert({
                company_id: companyId,
                operation: 'import',
                entity_definition_id: entityDefinitionId,
                file_name: fileName,
                rows_processed: rows.length,
                status: errorCount === 0 ? 'success' : 'failed',
                metadata: {
                    success: successCount,
                    duplicates: duplicateCount,
                    errors: errorCount
                },
            });

            let message = `Imported ${successCount} new records`;
            if (duplicateCount > 0) {
                message += `, skipped ${duplicateCount} duplicates`;
            }
            if (errorCount > 0) {
                message += `, ${errorCount} failed`;
            }

            setSuccess(message);
            toast.success(message);

            if (duplicateCount > 0) {
                toast.info(`Skipped ${duplicateCount} duplicate records`);
            }

            onSuccess();
            setTimeout(() => setOpen(false), 1500);
        } catch (err: any) {
            setError(err.message || 'Failed to import');
            toast.error(err.message || 'Failed to import');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Import / Export
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Import / Export {entityName}</DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'import' | 'export')}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="import">
                            <Upload className="h-4 w-4 mr-2" />
                            Import Data
                        </TabsTrigger>
                        <TabsTrigger value="export">
                            <Download className="h-4 w-4 mr-2" />
                            Export Data
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="import" className="space-y-4">
                        {/* File Upload */}
                        <div className="border-2 border-dashed rounded-lg p-6 text-center relative">
                            {file ? (
                                <div className="space-y-2">
                                    <FileSpreadsheet className="h-12 w-12 mx-auto text-primary" />
                                    <p className="font-medium">{file.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {(file.size / 1024).toFixed(1)} KB
                                    </p>
                                    <div className="flex gap-2 justify-center">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setFile(null);
                                                setPreviewData([]);
                                                setColumnMapping({});
                                                setError(null);
                                                setSuccess(null);
                                            }}
                                        >
                                            Change file
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleExportTemplate}
                                            disabled={loading}
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            Download Template
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">
                                        Drop your Excel or CSV file here, or click to browse
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        First, download the template to see the required columns
                                    </p>
                                    <div className="flex gap-2 justify-center">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleExportTemplate}
                                            disabled={loading}
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            Download Template
                                        </Button>
                                        <input
                                            type="file"
                                            accept=".xlsx,.xls,.csv"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Unique Identifier Field */}
                        {Object.keys(columnMapping).length > 0 && (
                            <div className="space-y-2">
                                <Label>Unique Identifier Field (Optional)</Label>
                                <Select value={idField} onValueChange={setIdField}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a field to check for duplicates" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">None (auto-detect)</SelectItem>
                                        {fields.map((field) => (
                                            <SelectItem key={field.field_key} value={field.field_key}>
                                                {field.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Records with matching values in this field will be skipped as duplicates.
                                </p>
                            </div>
                        )}

                        {/* Skip Duplicates Toggle */}
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="skipDuplicates"
                                checked={skipDuplicates}
                                onCheckedChange={(checked) => setSkipDuplicates(checked as boolean)}
                            />
                            <Label htmlFor="skipDuplicates" className="cursor-pointer">
                                Skip duplicate records
                            </Label>
                        </div>

                        {/* Column Mapping */}
                        {Object.keys(columnMapping).length > 0 && (
                            <div className="space-y-2">
                                <h4 className="font-medium">Column Mapping</h4>
                                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                    {Object.entries(columnMapping).map(([header, fieldKey]) => {
                                        const field = fields.find((f) => f.field_key === fieldKey);
                                        return (
                                            <div key={header} className="flex items-center gap-2 text-sm">
                                                <span className="text-muted-foreground truncate">{header}</span>
                                                <span className="text-muted-foreground">→</span>
                                                <Select
                                                    value={fieldKey}
                                                    onValueChange={(value) => {
                                                        setColumnMapping((prev) => ({
                                                            ...prev,
                                                            [header]: value,
                                                        }));
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue>
                                                            {field?.name || 'Skip'}
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="skip">Skip</SelectItem>
                                                        {fields.map((f) => (
                                                            <SelectItem key={f.field_key} value={f.field_key}>
                                                                {f.name} {f.is_required ? '*' : ''}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Preview */}
                        {previewData.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="font-medium">Preview (first 5 rows)</h4>
                                <div className="border rounded-lg overflow-auto max-h-48">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted">
                                            <tr>
                                                {Object.keys(previewData[0] || {}).map((key) => (
                                                    <th key={key} className="p-2 text-left font-medium">
                                                        {key}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewData.map((row, idx) => (
                                                <tr key={idx} className="border-t">
                                                    {Object.values(row).map((value: any, colIdx) => (
                                                        <td key={colIdx} className="p-2">
                                                            {String(value).length > 50
                                                                ? String(value).substring(0, 50) + '...'
                                                                : String(value)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {success && (
                            <Alert className="border-green-500 bg-green-50">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <AlertDescription className="text-green-700">{success}</AlertDescription>
                            </Alert>
                        )}

                        {loading && (
                            <div className="space-y-2">
                                <Progress value={progress} />
                                <p className="text-xs text-muted-foreground text-center">
                                    {progress < 30 && 'Reading file...'}
                                    {progress >= 30 && progress < 50 && 'Validating data...'}
                                    {progress >= 50 && progress < 80 && 'Importing records...'}
                                    {progress >= 80 && progress < 100 && 'Finalizing...'}
                                    {progress >= 100 && 'Complete!'}
                                </p>
                            </div>
                        )}

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={!file || loading || Object.keys(columnMapping).length === 0}
                            >
                                {loading ? 'Importing...' : 'Import'}
                            </Button>
                        </DialogFooter>
                    </TabsContent>

                    <TabsContent value="export" className="space-y-4">
                        <div className="text-center py-8 space-y-4">
                            <FileSpreadsheet className="h-16 w-16 mx-auto text-primary" />
                            <div>
                                <h3 className="font-semibold">Export {entityName} Data</h3>
                                <p className="text-sm text-muted-foreground">
                                    Export all {entityName} records to Excel or CSV format
                                </p>
                            </div>

                            <div className="flex gap-4 justify-center">
                                <Button
                                    onClick={() => handleExport('xlsx')}
                                    disabled={loading}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export as Excel
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => handleExport('csv')}
                                    disabled={loading}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export as CSV
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleExportTemplate}
                                    disabled={loading}
                                >
                                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                                    Download Template
                                </Button>
                            </div>

                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpen(false)}>
                                Close
                            </Button>
                        </DialogFooter>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}