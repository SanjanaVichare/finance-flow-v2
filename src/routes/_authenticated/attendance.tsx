// src/routes/_authenticated/attendance.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AttendanceTracker } from '@/components/dynamic/AttendanceTracker';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, Users, Building2, GraduationCap, Briefcase, CalendarDays, Clock, ChevronRight } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/attendance')({
  component: AttendancePage,
});

// ─── Color Palette ─────────────────────────────────────
const COLORS = {
  warmGold: "#FFD691",
  deepBlue: "#233A66",
  mutedGold: "#D7A859",
  softPink: "#FF6E80",
  white: "#FFFFFF",
  cream: "#F8F6F0",
  darkNavy: "#1A2A4A",
};

// ─── Scrollbar Styles ─────────────────────────────────
const scrollbarStyles = `
  .attendance-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .attendance-scroll::-webkit-scrollbar-track {
    background: ${COLORS.cream};
    border-radius: 3px;
  }
  .attendance-scroll::-webkit-scrollbar-thumb {
    background: ${COLORS.mutedGold};
    border-radius: 3px;
    transition: background 0.2s ease;
  }
  .attendance-scroll::-webkit-scrollbar-thumb:hover {
    background: ${COLORS.deepBlue};
  }
  .attendance-scroll {
    scrollbar-width: thin;
    scrollbar-color: ${COLORS.mutedGold} ${COLORS.cream};
  }
`;

// Group icon mapping
const iconMap: Record<string, React.ReactNode> = {
  'team': <Users className="h-5 w-5" />,
  'department': <Building2 className="h-5 w-5" />,
  'class': <GraduationCap className="h-5 w-5" />,
  'project': <Briefcase className="h-5 w-5" />,
};

function AttendancePage() {
  const [entityDefinitions, setEntityDefinitions] = useState<any[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    loadEntityDefinitions();
  }, []);

  const loadEntityDefinitions = async () => {
    try {
      setLoading(true);
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

      if (data && data.length > 0) {
        setSelectedEntityId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load entity definitions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEntitySelect = useCallback((value: string) => {
    setIsChanging(true);
    setSelectedEntityId(value);
    setTimeout(() => setIsChanging(false), 100);
  }, []);

  const handleChangeGroup = useCallback(() => {
    setSelectedEntityId('');
  }, []);

  const selectedEntity = useMemo(() =>
    entityDefinitions.find(e => e.id === selectedEntityId),
    [entityDefinitions, selectedEntityId]
  );

  const groupOptions = useMemo(() =>
    entityDefinitions.map((def) => ({
      ...def,
      icon: iconMap[def.icon] || <Users className="h-5 w-5" />
    })),
    [entityDefinitions]
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4" style={{ backgroundColor: COLORS.cream }}>
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-xl animate-pulse" style={{ backgroundColor: COLORS.warmGold }} />
          <Loader2 className="h-10 w-10 animate-spin relative" style={{ color: COLORS.deepBlue }} />
        </div>
        <p className="text-sm font-medium" style={{ color: COLORS.mutedGold }}>Loading your groups...</p>
      </div>
    );
  }

  if (entityDefinitions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 attendance-scroll" style={{ backgroundColor: COLORS.cream }}>
        <style>{scrollbarStyles}</style>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight" style={{ color: COLORS.deepBlue }}>
            Attendance Tracker
          </h1>
          <p className="text-lg" style={{ color: COLORS.mutedGold }}>
            Track and manage attendance for your teams, classes, or projects
          </p>
        </div>

        <Card className="border-2 border-dashed" style={{ borderColor: COLORS.mutedGold, backgroundColor: COLORS.white }}>
          <CardContent className="py-16">
            <div className="text-center space-y-6 max-w-md mx-auto">
              <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.warmGold }}>
                <Users className="h-10 w-10" style={{ color: COLORS.deepBlue }} />
              </div>
              <div>
                <h3 className="text-2xl font-semibold" style={{ color: COLORS.deepBlue }}>No Groups Yet</h3>
                <p className="mt-2" style={{ color: COLORS.mutedGold }}>
                  Create your first group in the <span className="font-medium" style={{ color: COLORS.deepBlue }}>Dynamic Records</span> section to start tracking attendance.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!selectedEntityId) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 attendance-scroll" style={{ backgroundColor: COLORS.cream }}>
        <style>{scrollbarStyles}</style>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight" style={{ color: COLORS.deepBlue }}>
            Attendance Tracker
          </h1>
          <p className="text-lg" style={{ color: COLORS.mutedGold }}>
            Select a group to start tracking attendance
          </p>
        </div>

        <Card className="shadow-lg border-0" style={{ backgroundColor: COLORS.white }}>
          <CardContent className="p-8">
            <div className="space-y-6">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ backgroundColor: COLORS.warmGold }}>
                  <CalendarDays className="h-8 w-8" style={{ color: COLORS.deepBlue }} />
                </div>
                <h2 className="text-2xl font-semibold" style={{ color: COLORS.deepBlue }}>Choose a Group</h2>
                <p className="text-sm" style={{ color: COLORS.mutedGold }}>
                  Select which group you'd like to track attendance for
                </p>
              </div>

              {/* Quick Select Grid */}
              <div className="pt-4">
                <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: COLORS.mutedGold }}>
                  Quick Access
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {groupOptions.slice(0, 4).map((def) => (
                    <button
                      key={def.id}
                      onClick={() => handleEntitySelect(def.id)}
                      className="group flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 text-left"
                      style={{
                        borderColor: COLORS.mutedGold,
                        backgroundColor: COLORS.white,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = COLORS.deepBlue;
                        e.currentTarget.style.backgroundColor = COLORS.cream;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = COLORS.mutedGold;
                        e.currentTarget.style.backgroundColor = COLORS.white;
                      }}
                    >
                      <span className="transition-colors" style={{ color: COLORS.mutedGold }}>
                        {def.icon}
                      </span>
                      <span className="font-medium text-sm truncate flex-1" style={{ color: COLORS.deepBlue }}>{def.name}</span>
                      <ChevronRight className="h-4 w-4 transition-colors" style={{ color: COLORS.mutedGold }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 attendance-scroll" style={{ backgroundColor: COLORS.cream }}>
      <style>{scrollbarStyles}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border" style={{
        backgroundColor: COLORS.white,
        borderColor: COLORS.mutedGold,
      }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: COLORS.warmGold }}>
            {selectedEntity?.icon && iconMap[selectedEntity.icon]}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: COLORS.deepBlue }}>
              {selectedEntity?.name}
            </h1>
            {selectedEntity?.description && (
              <p className="text-sm" style={{ color: COLORS.mutedGold }}>
                {selectedEntity.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border" style={{
            color: COLORS.mutedGold,
            backgroundColor: COLORS.cream,
            borderColor: COLORS.mutedGold,
          }}>
            <Clock className="h-4 w-4" />
            <span>Today</span>
          </div>
          <button
            onClick={handleChangeGroup}
            className="inline-flex items-center gap-2 text-sm font-medium transition-colors px-4 py-2 rounded-xl"
            style={{ color: COLORS.mutedGold }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = COLORS.deepBlue;
              e.currentTarget.style.backgroundColor = COLORS.cream;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = COLORS.mutedGold;
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Change Group
          </button>
        </div>
      </div>

      {/* Tracker */}
      <div className={isChanging ? 'opacity-50 transition-opacity duration-150' : 'transition-opacity duration-150'}>
        <AttendanceTracker
          entityDefinitionId={selectedEntityId}
          entityName={selectedEntity?.name || ''}
        />
      </div>
    </div>
  );
}