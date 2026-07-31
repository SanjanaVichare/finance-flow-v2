// src/routes/_authenticated/dynamic.tsx
import { createFileRoute } from '@tanstack/react-router';
import { DynamicTable } from '@/components/dynamic/DynamicTable';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/dynamic')({
    component: DynamicRecordsPage,
});

function DynamicRecordsPage() {
    const [entityDefinitions, setEntityDefinitions] = useState<any[]>([]);
    const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadEntityDefinitions();
    }, []);

    const loadEntityDefinitions = async () => {
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) return;

            const { data: memberData } = await supabase
                .from('company_members')
                .select('company_id')
                .eq('user_id', userData.user.id)
                .single();

            if (!memberData) return;

            const { data, error } = await supabase
                .from('entity_definitions')
                .select('*')
                .eq('company_id', memberData.company_id)
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            setEntityDefinitions(data || []);
        } catch (error) {
            console.error('Failed to load entity definitions:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64">Loading...</div>;
    }

    if (!selectedEntityId) {
        return (
            <div className="space-y-4">
                <h1 className="text-2xl font-bold">Dynamic Records</h1>
                <p className="text-muted-foreground">Select an entity type to manage</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {entityDefinitions.map((def) => (
                        <Card
                            key={def.id}
                            className="cursor-pointer hover:shadow-lg transition-shadow"
                            onClick={() => {
                                setSelectedEntityId(def.id);
                            }}
                        >
                            <CardContent className="p-6 flex items-center gap-4">
                                <div className="text-4xl">{def.icon || '📋'}</div>
                                <div>
                                    <h3 className="font-semibold">{def.name}</h3>
                                    <p className="text-sm text-muted-foreground">Manage {def.name.toLowerCase()}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {entityDefinitions.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        No entity definitions found. Please run the SQL migration to create them.
                    </div>
                )}
            </div>
        );
    }

    return (
        <div>
            <Button
                variant="ghost"
                className="mb-4"
                onClick={() => setSelectedEntityId(null)}
            >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to entities
            </Button>
            <DynamicTable entityDefinitionId={selectedEntityId} />
        </div>
    );
}