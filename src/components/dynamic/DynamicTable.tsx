// src/components/dynamic/DynamicTable.tsx
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Plus,
    Download,
    MoreVertical,
    Edit,
    Trash2,
    Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { ColumnEditor } from './ColumnEditor.tsx'; // Relative import
import { DynamicForm } from './DynamicForm.tsx'; // Relative import
import { format } from 'date-fns';
import { ImportExport } from './ImportExport.tsx';


// Define types locally
interface FieldDefinition {
    id: string;
    entity_definition_id: string;
    name: string;
    field_key: string;
    field_type: string;
    is_required: boolean;
    is_unique: boolean;
    options: string[] | null;
    default_value: any;
    display_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface EntityDefinition {
    id: string;
    company_id: string;
    name: string;
    icon: string | null;
    is_active: boolean;
    fields: FieldDefinition[];
    created_at: string;
    updated_at: string;
}

interface Entity {
    id: string;
    company_id: string;
    entity_definition_id: string | null;
    user_id: string | null;
    type: string;
    name: string;
    email: string | null;
    phone: string | null;
    code: string | null;
    department: string | null;
    class_name: string | null;
    notes: string | null;
    metadata: Record<string, any>;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

interface DynamicTableProps {
    entityDefinitionId: string;
}

export function DynamicTable({ entityDefinitionId }: DynamicTableProps) {
    const [showForm, setShowForm] = useState(false);
    const [editingRecord, setEditingRecord] = useState<Entity | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();

    // Fetch entity definition with fields
    const { data: entityDef, isLoading: defLoading } = useQuery({
        queryKey: ['entity-definition', entityDefinitionId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('entity_definitions')
                .select(`
          *,
          fields:field_definitions(*)
        `)
                .eq('id', entityDefinitionId)
                .single();
            if (error) throw error;
            return data as unknown as EntityDefinition;
        },
    });

    // Fetch records
    const { data: records, refetch, isLoading: recordsLoading } = useQuery({
        queryKey: ['entities', entityDefinitionId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('entities')
                .select('*')
                .eq('entity_definition_id', entityDefinitionId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as unknown as Entity[];
        },
    });

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete "${name}"? This action cannot be undone.`)) return;

        const { error } = await supabase
            .from('entities')
            .delete()
            .eq('id', id);

        if (error) {
            toast.error(error.message);
            return;
        }

        toast.success('Record deleted');
        refetch();
    };

    const renderFieldValue = (value: any, fieldType: string) => {
        if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;

        switch (fieldType) {
            case 'boolean':
                return value ? <Badge variant="default">Yes</Badge> : <Badge variant="secondary">No</Badge>;
            case 'date':
                return format(new Date(value), 'MMM d, yyyy');
            case 'currency':
                return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value));
            case 'email':
                return <a href={`mailto:${value}`} className="text-primary hover:underline">{value}</a>;
            case 'phone':
                return <a href={`tel:${value}`} className="text-primary hover:underline">{value}</a>;
            default:
                return String(value);
        }
    };

    if (defLoading || !entityDef) {
        return <div className="flex items-center justify-center h-64">Loading...</div>;
    }

    const fields = entityDef.fields || [];

    const getMetadataValue = (record: Entity, fieldKey: string): any => {
        if (!record.metadata) return null;
        const metadata = record.metadata as Record<string, any>;
        return metadata[fieldKey] ?? null;
    };

    const filteredRecords = records?.filter((record) => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        const metadata = record.metadata as Record<string, any> || {};
        return Object.values(metadata).some(
            (value) => String(value).toLowerCase().includes(searchLower)
        ) || record.name?.toLowerCase().includes(searchLower);
    });

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        {entityDef.icon && <span>{entityDef.icon}</span>}
                        {entityDef.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {records?.length || 0} records
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 w-[200px]"
                        />
                    </div>

                    <ImportExport
                        entityDefinitionId={entityDefinitionId}
                        entityName={entityDef.name}
                        fields={fields}
                        onSuccess={() => refetch()}
                    />

                    <ColumnEditor entityDefinitionId={entityDefinitionId} />

                    <Button size="sm" onClick={() => { setEditingRecord(null); setShowForm(true); }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Record
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {fields.map((field) => (
                                <TableHead key={field.id}>
                                    {field.is_required && <span className="text-destructive mr-1">*</span>}
                                    {field.name}
                                </TableHead>
                            ))}
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {recordsLoading ? (
                            <TableRow>
                                <TableCell colSpan={fields.length + 1} className="text-center py-8">
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : filteredRecords?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={fields.length + 1} className="text-center py-8 text-muted-foreground">
                                    No records found. Click "Add Record" to create one.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredRecords?.map((record) => (
                                <TableRow key={record.id}>
                                    {fields.map((field) => (
                                        <TableCell key={field.id}>
                                            {renderFieldValue(getMetadataValue(record, field.field_key), field.field_type)}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setEditingRecord(record);
                                                        setShowForm(true);
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-destructive"
                                                    onClick={() => handleDelete(record.id, record.name)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Add/Edit Form Dialog */}
            <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingRecord ? 'Edit Record' : 'Add Record'}
                        </DialogTitle>
                    </DialogHeader>
                    <DynamicForm
                        entityDefinitionId={entityDefinitionId}
                        fields={fields}
                        initialData={editingRecord}
                        onSuccess={() => {
                            setShowForm(false);
                            refetch();
                            toast.success(editingRecord ? 'Record updated' : 'Record created');
                        }}
                        onCancel={() => setShowForm(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}