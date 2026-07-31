// src/components/dynamic/ColumnEditor.tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Settings, Plus, Trash2, GripVertical, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

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

interface ColumnEditorProps {
    entityDefinitionId: string;
}

const FIELD_TYPES = [
    { value: 'text', label: 'Text' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'number', label: 'Number' },
    { value: 'currency', label: 'Currency' },
    { value: 'date', label: 'Date' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'boolean', label: 'Boolean (Yes/No)' },
    { value: 'dropdown', label: 'Dropdown' },
    { value: 'multi_select', label: 'Multi-Select' },
];

const parseOptions = (options: any): string[] | null => {
    if (!options) return null;
    if (Array.isArray(options)) return options as string[];
    if (typeof options === 'string') {
        try {
            const parsed = JSON.parse(options);
            return Array.isArray(parsed) ? parsed : null;
        } catch {
            return null;
        }
    }
    return null;
};

export function ColumnEditor({ entityDefinitionId }: ColumnEditorProps) {
    const [open, setOpen] = useState(false);
    const [fields, setFields] = useState<FieldDefinition[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [loading, setLoading] = useState(false);
    const [newField, setNewField] = useState({
        name: '',
        field_type: 'text',
        is_required: false,
        is_unique: false,
        options: '',
    });
    const queryClient = useQueryClient();

    const loadFields = async () => {
        try {
            const { data, error } = await supabase
                .from('field_definitions')
                .select('*')
                .eq('entity_definition_id', entityDefinitionId)
                .order('display_order');

            if (error) throw error;

            const convertedFields: FieldDefinition[] = (data || []).map((item: any) => ({
                ...item,
                options: parseOptions(item.options),
                default_value: item.default_value,
            }));

            setFields(convertedFields);
        } catch (error: any) {
            toast.error(error.message || 'Failed to load fields');
        }
    };

    useEffect(() => {
        if (open) {
            loadFields();
        }
    }, [open]);

    const handleAddField = async () => {
        if (!newField.name.trim()) {
            toast.error('Field name is required');
            return;
        }

        setLoading(true);
        try {
            const fieldKey = newField.name
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '_')
                .replace(/_+/g, '_');

            const options = newField.options
                ? newField.options.split(',').map((s) => s.trim()).filter(Boolean)
                : null;

            const { data, error } = await supabase
                .from('field_definitions')
                .insert({
                    entity_definition_id: entityDefinitionId,
                    name: newField.name.trim(),
                    field_key: fieldKey,
                    field_type: newField.field_type,
                    is_required: newField.is_required,
                    is_unique: newField.is_unique,
                    options: options as any,
                    display_order: fields.length,
                })
                .select()
                .single();

            if (error) throw error;

            const newFieldDef: FieldDefinition = {
                ...data,
                options: parseOptions(data.options),
                default_value: data.default_value,
            };

            setFields([...fields, newFieldDef]);
            setNewField({ name: '', field_type: 'text', is_required: false, is_unique: false, options: '' });
            setIsAdding(false);
            queryClient.invalidateQueries({ queryKey: ['entity-definition', entityDefinitionId] });
            toast.success('Column added');
        } catch (error: any) {
            toast.error(error.message || 'Failed to add column');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteField = async (fieldId: string) => {
        if (!confirm('Delete this column? This will also delete all data in this column.')) return;

        try {
            const { error } = await supabase
                .from('field_definitions')
                .delete()
                .eq('id', fieldId);

            if (error) throw error;

            setFields(fields.filter((f) => f.id !== fieldId));
            queryClient.invalidateQueries({ queryKey: ['entity-definition', entityDefinitionId] });
            toast.success('Column deleted');
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete column');
        }
    };

    const handleToggleField = async (fieldId: string, isActive: boolean) => {
        try {
            const { error } = await supabase
                .from('field_definitions')
                .update({ is_active: isActive })
                .eq('id', fieldId);

            if (error) throw error;

            setFields(fields.map((f) => (f.id === fieldId ? { ...f, is_active: isActive } : f)));
            queryClient.invalidateQueries({ queryKey: ['entity-definition', entityDefinitionId] });
        } catch (error: any) {
            toast.error(error.message || 'Failed to update field');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Columns
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Manage Columns</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {isAdding ? (
                        <div className="space-y-3 p-4 border rounded-lg">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label>Field Name</Label>
                                    <Input
                                        value={newField.name}
                                        onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                                        placeholder="e.g., Roll Number"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Field Type</Label>
                                    <Select
                                        value={newField.field_type}
                                        onValueChange={(value) => setNewField({ ...newField, field_type: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {FIELD_TYPES.map((type) => (
                                                <SelectItem key={type.value} value={type.value}>
                                                    {type.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {['dropdown', 'multi_select'].includes(newField.field_type) && (
                                <div className="space-y-1.5">
                                    <Label>Options (comma separated)</Label>
                                    <Input
                                        value={newField.options}
                                        onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                                        placeholder="Option 1, Option 2, Option 3"
                                    />
                                </div>
                            )}

                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={newField.is_required}
                                        onCheckedChange={(checked) => setNewField({ ...newField, is_required: checked })}
                                    />
                                    <Label>Required</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={newField.is_unique}
                                        onCheckedChange={(checked) => setNewField({ ...newField, is_unique: checked })}
                                    />
                                    <Label>Unique</Label>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setIsAdding(false)}>
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={handleAddField} disabled={loading}>
                                    {loading ? 'Adding...' : 'Add Column'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button size="sm" onClick={() => setIsAdding(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Column
                        </Button>
                    )}

                    <div className="space-y-2">
                        {fields.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No columns defined yet. Add your first column above.
                            </p>
                        ) : (
                            fields.map((field) => (
                                <div
                                    key={field.id}
                                    className="flex items-center gap-3 p-3 bg-card rounded-lg border"
                                >
                                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{field.name}</span>
                                            <Badge variant="outline" className="text-xs">
                                                {FIELD_TYPES.find((t) => t.value === field.field_type)?.label || field.field_type}
                                            </Badge>
                                            {field.is_required && (
                                                <Badge variant="destructive" className="text-xs">Required</Badge>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            Key: {field.field_key}
                                            {field.options && field.options.length > 0 && ` · Options: ${field.options.join(', ')}`}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleToggleField(field.id, !field.is_active)}
                                    >
                                        {field.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive"
                                        onClick={() => handleDeleteField(field.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}