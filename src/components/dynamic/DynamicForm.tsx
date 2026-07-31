// src/components/dynamic/DynamicForm.tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';

interface FieldDefinition {
    id: string;
    name: string;
    field_key: string;
    field_type: string;
    is_required: boolean;
    options: string[] | null;
    default_value: any;
}

interface DynamicFormProps {
    entityDefinitionId: string;
    fields: FieldDefinition[];
    initialData?: any;
    onSuccess: () => void;
    onCancel: () => void;
}

export function DynamicForm({
    entityDefinitionId,
    fields,
    initialData,
    onSuccess,
    onCancel,
}: DynamicFormProps) {
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (initialData) {
            setFormData(initialData.metadata || {});
        } else {
            // Set default values
            const defaults: Record<string, any> = {};
            fields.forEach((field) => {
                if (field.default_value !== null && field.default_value !== undefined) {
                    defaults[field.field_key] = field.default_value;
                }
            });
            setFormData(defaults);
        }
    }, [initialData, fields]);

    const handleChange = (fieldKey: string, value: any) => {
        setFormData((prev) => ({ ...prev, [fieldKey]: value }));
        // Clear error for this field
        if (errors[fieldKey]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[fieldKey];
                return newErrors;
            });
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        fields.forEach((field) => {
            if (field.is_required) {
                const value = formData[field.field_key];
                if (value === undefined || value === null || value === '') {
                    newErrors[field.field_key] = `${field.name} is required`;
                }
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // src/components/dynamic/DynamicForm.tsx
    // Replace the handleSubmit function (around line 100-140) with this:

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError || !userData?.user) {
                toast.error('Please sign in to continue');
                return;
            }

            // Get the user's company
            const { data: memberData, error: memberError } = await supabase
                .from('company_members')
                .select('company_id')
                .eq('user_id', userData.user.id)
                .single();

            if (memberError || !memberData) {
                toast.error('No company found for this user');
                return;
            }

            if (initialData) {
                // Update existing record
                const { error } = await supabase
                    .from('entities')
                    .update({
                        metadata: formData,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', initialData.id);

                if (error) throw error;
            } else {
                // Create new record
                const { error } = await supabase
                    .from('entities')
                    .insert({
                        entity_definition_id: entityDefinitionId,
                        company_id: memberData.company_id,
                        name: formData.full_name || formData.name || 'Untitled',
                        type: 'employee',
                        metadata: formData,
                        created_by: userData.user.id,
                    });

                if (error) throw error;
            }

            onSuccess();
        } catch (error: any) {
            console.error('Error saving record:', error);
            toast.error(error.message || 'Failed to save record');
        } finally {
            setLoading(false);
        }
    };

    const renderField = (field: FieldDefinition) => {
        const value = formData[field.field_key];
        const error = errors[field.field_key];

        switch (field.field_type) {
            case 'textarea':
                return (
                    <Textarea
                        id={field.field_key}
                        value={value || ''}
                        onChange={(e) => handleChange(field.field_key, e.target.value)}
                        className={error ? 'border-destructive' : ''}
                    />
                );

            case 'boolean':
                return (
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id={field.field_key}
                            checked={value || false}
                            onCheckedChange={(checked) => handleChange(field.field_key, checked)}
                        />
                        <Label htmlFor={field.field_key} className="cursor-pointer">
                            {value ? 'Yes' : 'No'}
                        </Label>
                    </div>
                );

            case 'date':
                return (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    'w-full justify-start text-left font-normal',
                                    !value && 'text-muted-foreground',
                                    error && 'border-destructive'
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {value ? format(new Date(value), 'PPP') : 'Select date'}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={value ? new Date(value) : undefined}
                                onSelect={(date) => handleChange(field.field_key, date?.toISOString())}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                );

            case 'dropdown':
                return (
                    <Select
                        value={value || ''}
                        onValueChange={(val) => handleChange(field.field_key, val)}
                    >
                        <SelectTrigger className={error ? 'border-destructive' : ''}>
                            <SelectValue placeholder={`Select ${field.name}`} />
                        </SelectTrigger>
                        <SelectContent>
                            {field.options?.map((option) => (
                                <SelectItem key={option} value={option}>
                                    {option}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );

            case 'multi_select':
                const options = field.options || [];
                const selectedValues = Array.isArray(value) ? value : [];
                return (
                    <div className="space-y-2">
                        {options.map((option) => (
                            <div key={option} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`${field.field_key}-${option}`}
                                    checked={selectedValues.includes(option)}
                                    onCheckedChange={(checked) => {
                                        const newValues = checked
                                            ? [...selectedValues, option]
                                            : selectedValues.filter((v: string) => v !== option);
                                        handleChange(field.field_key, newValues);
                                    }}
                                />
                                <Label htmlFor={`${field.field_key}-${option}`}>{option}</Label>
                            </div>
                        ))}
                    </div>
                );

            case 'number':
            case 'currency':
                return (
                    <Input
                        id={field.field_key}
                        type="number"
                        step="0.01"
                        value={value || ''}
                        onChange={(e) => handleChange(field.field_key, parseFloat(e.target.value) || 0)}
                        className={error ? 'border-destructive' : ''}
                    />
                );

            default:
                return (
                    <Input
                        id={field.field_key}
                        type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : 'text'}
                        value={value || ''}
                        onChange={(e) => handleChange(field.field_key, e.target.value)}
                        className={error ? 'border-destructive' : ''}
                    />
                );
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map((field) => (
                <div key={field.id} className="space-y-1.5">
                    <Label htmlFor={field.field_key}>
                        {field.name}
                        {field.is_required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {renderField(field)}
                    {errors[field.field_key] && (
                        <p className="text-sm text-destructive">{errors[field.field_key]}</p>
                    )}
                </div>
            ))}

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading ? 'Saving...' : initialData ? 'Update' : 'Create'}
                </Button>
            </div>
        </form>
    );
}